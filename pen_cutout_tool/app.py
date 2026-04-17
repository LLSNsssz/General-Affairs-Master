from __future__ import annotations

import argparse
import json
import threading
import traceback
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

import cv2
import fitz
import numpy as np
from PIL import Image

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError:  # pragma: no cover - tkinter may be unavailable in some Python builds
    tk = None
    filedialog = None
    messagebox = None
    ttk = None


APP_TITLE = "볼펜 필기 누끼 추출기"


@dataclass(slots=True)
class ExtractionSettings:
    render_scale: float = 2.0
    threshold: int = 180
    background_sigma: float = 31.0
    group_gap: int = 115
    min_ink_pixels: int = 800
    min_component_side: int = 80
    padding: int = 24
    soft_edge: int = 40
    save_individual: bool = True
    save_merged: bool = True


@dataclass(slots=True)
class ExtractedItem:
    bbox: tuple[int, int, int, int]
    ink_pixels: int
    image: np.ndarray


@dataclass(slots=True)
class RuntimeSettings:
    threshold: int
    background_sigma: float
    group_gap: int
    min_ink_pixels: int
    min_component_side: int
    padding: int
    soft_edge: int


def _odd(value: int) -> int:
    value = max(3, int(value))
    return value if value % 2 == 1 else value + 1


def resolve_runtime_settings(settings: ExtractionSettings) -> RuntimeSettings:
    scale = max(0.5, settings.render_scale / 2.0)
    return RuntimeSettings(
        threshold=int(settings.threshold),
        background_sigma=max(1.0, settings.background_sigma * scale),
        group_gap=_odd(int(round(settings.group_gap * scale))),
        min_ink_pixels=max(50, int(round(settings.min_ink_pixels * scale * scale))),
        min_component_side=max(12, int(round(settings.min_component_side * scale))),
        padding=max(2, int(round(settings.padding * scale))),
        soft_edge=max(8, int(round(settings.soft_edge * scale))),
    )


def render_pdf_page(page: fitz.Page, scale: float) -> np.ndarray:
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image = np.frombuffer(pixmap.samples, dtype=np.uint8)
    image = image.reshape(pixmap.height, pixmap.width, pixmap.n)
    if pixmap.n == 4:
        return cv2.cvtColor(image, cv2.COLOR_RGBA2BGR)
    return cv2.cvtColor(image, cv2.COLOR_RGB2BGR)


def build_ink_mask(image_bgr: np.ndarray, runtime: RuntimeSettings) -> tuple[np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    normalized = cv2.divide(
        gray,
        cv2.GaussianBlur(gray, (0, 0), sigmaX=runtime.background_sigma),
        scale=255,
    )
    _, hard_mask = cv2.threshold(normalized, runtime.threshold, 255, cv2.THRESH_BINARY_INV)
    hard_mask = cv2.morphologyEx(hard_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    hard_mask = cv2.medianBlur(hard_mask, 3)
    return gray, normalized, hard_mask


def make_alpha(
    normalized_crop: np.ndarray,
    local_mask: np.ndarray,
    threshold: int,
    soft_edge: int,
) -> np.ndarray:
    margin = max(8, int(soft_edge))
    alpha = ((threshold + margin - normalized_crop.astype(np.int16)) * 255) / margin
    alpha = np.clip(alpha, 0, 255).astype(np.uint8)
    alpha[cv2.dilate(local_mask.astype(np.uint8) * 255, np.ones((3, 3), np.uint8)) == 0] = 0
    return alpha


def detect_items(
    gray: np.ndarray,
    normalized: np.ndarray,
    hard_mask: np.ndarray,
    runtime: RuntimeSettings,
) -> list[ExtractedItem]:
    h, w = hard_mask.shape
    grouped = cv2.dilate(
        hard_mask,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (runtime.group_gap, runtime.group_gap)),
        iterations=1,
    )
    count, labels, stats, _ = cv2.connectedComponentsWithStats(grouped, 8)
    border_margin = 2
    found: list[ExtractedItem] = []

    for label in range(1, count):
        x, y, bw, bh, _ = stats[label]
        local_group = labels[y : y + bh, x : x + bw] == label
        local_mask = (hard_mask[y : y + bh, x : x + bw] > 0) & local_group
        ink_pixels = int(local_mask.sum())
        if ink_pixels < runtime.min_ink_pixels:
            continue

        ys, xs = np.where(local_mask)
        if xs.size == 0:
            continue

        x0 = int(xs.min())
        x1 = int(xs.max())
        y0 = int(ys.min())
        y1 = int(ys.max())
        width = x1 - x0 + 1
        height = y1 - y0 + 1

        if max(width, height) < runtime.min_component_side:
            continue

        gx0 = x + x0
        gy0 = y + y0
        gx1 = x + x1
        gy1 = y + y1

        if (
            gx0 <= border_margin
            or gy0 <= border_margin
            or gx1 >= w - border_margin - 1
            or gy1 >= h - border_margin - 1
        ):
            continue

        pad = runtime.padding
        crop_x0 = max(0, gx0 - pad)
        crop_y0 = max(0, gy0 - pad)
        crop_x1 = min(w, gx1 + pad + 1)
        crop_y1 = min(h, gy1 + pad + 1)

        crop_normalized = normalized[crop_y0:crop_y1, crop_x0:crop_x1]
        crop_gray = gray[crop_y0:crop_y1, crop_x0:crop_x1]
        crop_mask = np.zeros_like(crop_gray, dtype=bool)

        placed_y0 = gy0 - crop_y0
        placed_y1 = placed_y0 + height
        placed_x0 = gx0 - crop_x0
        placed_x1 = placed_x0 + width
        crop_mask[placed_y0:placed_y1, placed_x0:placed_x1] = local_mask[y0 : y1 + 1, x0 : x1 + 1]

        alpha = make_alpha(crop_normalized, crop_mask, runtime.threshold, runtime.soft_edge)
        rgba = np.dstack([crop_gray, crop_gray, crop_gray, alpha])
        found.append(ExtractedItem(bbox=(crop_x0, crop_y0, crop_x1, crop_y1), ink_pixels=ink_pixels, image=rgba))

    found.sort(key=lambda item: (item.bbox[1], item.bbox[0]))
    return found


def save_rgba_image(image: np.ndarray, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image).save(output_path)


def merge_items(
    page_shape: tuple[int, int],
    items: list[ExtractedItem],
    padding: int,
) -> tuple[np.ndarray, tuple[int, int, int, int]] | None:
    if not items:
        return None

    page_h, page_w = page_shape
    canvas = np.zeros((page_h, page_w, 4), dtype=np.uint8)

    min_x = page_w
    min_y = page_h
    max_x = 0
    max_y = 0

    for item in items:
        x0, y0, x1, y1 = item.bbox
        region = canvas[y0:y1, x0:x1]
        alpha = item.image[:, :, 3]
        blend_mask = alpha > region[:, :, 3]
        region[blend_mask] = item.image[blend_mask]

        min_x = min(min_x, x0)
        min_y = min(min_y, y0)
        max_x = max(max_x, x1)
        max_y = max(max_y, y1)

    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(page_w, max_x + padding)
    max_y = min(page_h, max_y + padding)

    return canvas[min_y:max_y, min_x:max_x], (min_x, min_y, max_x, max_y)


def extract_pdf(
    input_pdf: Path,
    output_dir: Path,
    settings: ExtractionSettings,
    log: Callable[[str], None] | None = None,
) -> dict:
    input_pdf = input_pdf.expanduser().resolve()
    output_dir = output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if input_pdf.suffix.lower() != ".pdf":
        raise ValueError("PDF 파일만 처리할 수 있습니다.")
    if not input_pdf.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {input_pdf}")

    log = log or (lambda _message: None)
    log(f"PDF 열기: {input_pdf}")
    runtime = resolve_runtime_settings(settings)
    manifest: dict[str, object] = {
        "input_pdf": str(input_pdf),
        "output_dir": str(output_dir),
        "settings": asdict(settings),
        "runtime_settings": asdict(runtime),
        "pages": [],
    }

    document = fitz.open(str(input_pdf))
    try:
        for page_index in range(document.page_count):
            log(f"{page_index + 1}/{document.page_count} 페이지 처리 중...")
            page_image = render_pdf_page(document.load_page(page_index), settings.render_scale)
            gray, normalized, hard_mask = build_ink_mask(page_image, runtime)
            items = detect_items(gray, normalized, hard_mask, runtime)

            page_name = f"page_{page_index + 1:02d}"
            page_dir = output_dir / page_name
            saved_items: list[str] = []

            if settings.save_individual:
                for item_index, item in enumerate(items, start=1):
                    item_path = page_dir / f"{page_name}_item_{item_index:02d}.png"
                    save_rgba_image(item.image, item_path)
                    saved_items.append(str(item_path))

            merged_path: str | None = None
            if settings.save_merged:
                merged = merge_items(gray.shape, items, runtime.padding)
                if merged is not None:
                    merged_image, _ = merged
                    merged_file = output_dir / f"{page_name}_all.png"
                    save_rgba_image(merged_image, merged_file)
                    merged_path = str(merged_file)

            manifest["pages"].append(
                {
                    "page": page_index + 1,
                    "item_count": len(items),
                    "items": saved_items,
                    "merged": merged_path,
                }
            )

        manifest_path = output_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        log(f"완료: {manifest_path}")
        return manifest
    finally:
        document.close()


class PenCutoutApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title(APP_TITLE)
        self.root.geometry("760x620")
        self.root.minsize(720, 560)

        self.pdf_path_var = tk.StringVar()
        self.output_dir_var = tk.StringVar()
        self.render_scale_var = tk.StringVar(value="2.0")
        self.threshold_var = tk.StringVar(value="180")
        self.group_gap_var = tk.StringVar(value="115")
        self.min_ink_pixels_var = tk.StringVar(value="800")
        self.min_component_side_var = tk.StringVar(value="80")
        self.padding_var = tk.StringVar(value="24")
        self.save_individual_var = tk.BooleanVar(value=True)
        self.save_merged_var = tk.BooleanVar(value=True)

        self._build_ui()

    def _build_ui(self) -> None:
        container = ttk.Frame(self.root, padding=16)
        container.pack(fill="both", expand=True)
        container.columnconfigure(1, weight=1)

        ttk.Label(container, text="PDF 파일").grid(row=0, column=0, sticky="w", pady=(0, 8))
        ttk.Entry(container, textvariable=self.pdf_path_var).grid(row=0, column=1, sticky="ew", pady=(0, 8))
        ttk.Button(container, text="찾아보기", command=self.choose_pdf).grid(row=0, column=2, padx=(8, 0), pady=(0, 8))

        ttk.Label(container, text="출력 폴더").grid(row=1, column=0, sticky="w", pady=(0, 12))
        ttk.Entry(container, textvariable=self.output_dir_var).grid(row=1, column=1, sticky="ew", pady=(0, 12))
        ttk.Button(container, text="찾아보기", command=self.choose_output_dir).grid(row=1, column=2, padx=(8, 0), pady=(0, 12))

        options = ttk.LabelFrame(container, text="추출 옵션", padding=12)
        options.grid(row=2, column=0, columnspan=3, sticky="ew")
        options.columnconfigure(1, weight=1)
        options.columnconfigure(3, weight=1)

        self._add_option(options, 0, "렌더 배율", self.render_scale_var, "2.0")
        self._add_option(options, 1, "어두움 임계값", self.threshold_var, "180")
        self._add_option(options, 2, "글자 묶기 거리(px)", self.group_gap_var, "115")
        self._add_option(options, 3, "최소 잉크 픽셀", self.min_ink_pixels_var, "800")
        self._add_option(options, 4, "최소 가로/세로", self.min_component_side_var, "80")
        self._add_option(options, 5, "여백(px)", self.padding_var, "24")

        checks = ttk.Frame(options)
        checks.grid(row=6, column=0, columnspan=4, sticky="w", pady=(8, 0))
        ttk.Checkbutton(checks, text="개별 PNG 저장", variable=self.save_individual_var).pack(side="left", padx=(0, 12))
        ttk.Checkbutton(checks, text="페이지 합본 저장", variable=self.save_merged_var).pack(side="left")

        hint = (
            "배경 그림자 때문에 자동 보정 후 검은 필기만 분리합니다. "
            "체크/이름이 잘 안 묶이면 '글자 묶기 거리'를 조금 올려보세요."
        )
        ttk.Label(container, text=hint, wraplength=700, foreground="#555").grid(
            row=3, column=0, columnspan=3, sticky="w", pady=(12, 12)
        )

        action_bar = ttk.Frame(container)
        action_bar.grid(row=4, column=0, columnspan=3, sticky="ew")
        action_bar.columnconfigure(0, weight=1)
        self.run_button = ttk.Button(action_bar, text="추출 시작", command=self.run_extraction)
        self.run_button.grid(row=0, column=1, sticky="e")

        ttk.Label(container, text="작업 로그").grid(row=5, column=0, columnspan=3, sticky="w", pady=(16, 8))
        self.log_text = tk.Text(container, height=18, wrap="word")
        self.log_text.grid(row=6, column=0, columnspan=3, sticky="nsew")
        container.rowconfigure(6, weight=1)

    def _add_option(
        self,
        parent: ttk.LabelFrame,
        row: int,
        label: str,
        variable: tk.StringVar,
        placeholder: str,
    ) -> None:
        left_col = 0 if row % 2 == 0 else 2
        field_col = 1 if row % 2 == 0 else 3
        grid_row = row // 2
        ttk.Label(parent, text=label).grid(row=grid_row, column=left_col, sticky="w", padx=(0, 8), pady=6)
        entry = ttk.Entry(parent, textvariable=variable)
        entry.grid(row=grid_row, column=field_col, sticky="ew", pady=6)

    def choose_pdf(self) -> None:
        selected = filedialog.askopenfilename(filetypes=[("PDF files", "*.pdf")])
        if not selected:
            return
        self.pdf_path_var.set(selected)
        pdf_path = Path(selected)
        default_output = pdf_path.with_name(f"{pdf_path.stem}_pen_cutouts")
        self.output_dir_var.set(str(default_output))
        self.log(f"선택한 PDF: {selected}")

    def choose_output_dir(self) -> None:
        selected = filedialog.askdirectory()
        if selected:
            self.output_dir_var.set(selected)

    def log(self, message: str) -> None:
        self.log_text.insert("end", f"{message}\n")
        self.log_text.see("end")
        self.root.update_idletasks()

    def log_from_worker(self, message: str) -> None:
        self.root.after(0, lambda: self.log(message))

    def get_settings(self) -> ExtractionSettings:
        return ExtractionSettings(
            render_scale=float(self.render_scale_var.get()),
            threshold=int(self.threshold_var.get()),
            group_gap=int(self.group_gap_var.get()),
            min_ink_pixels=int(self.min_ink_pixels_var.get()),
            min_component_side=int(self.min_component_side_var.get()),
            padding=int(self.padding_var.get()),
            save_individual=bool(self.save_individual_var.get()),
            save_merged=bool(self.save_merged_var.get()),
        )

    def run_extraction(self) -> None:
        pdf_text = self.pdf_path_var.get().strip()
        output_text = self.output_dir_var.get().strip()
        if not pdf_text:
            messagebox.showwarning(APP_TITLE, "PDF 파일을 먼저 선택해주세요.")
            return
        if not output_text:
            output_text = str(Path(pdf_text).with_name(f"{Path(pdf_text).stem}_pen_cutouts"))
            self.output_dir_var.set(output_text)

        try:
            settings = self.get_settings()
        except ValueError:
            messagebox.showerror(APP_TITLE, "옵션 값은 숫자로 입력해주세요.")
            return

        self.run_button.config(state="disabled")
        self.log_text.delete("1.0", "end")

        def worker() -> None:
            try:
                manifest = extract_pdf(Path(pdf_text), Path(output_text), settings, log=self.log_from_worker)
                total = sum(int(page["item_count"]) for page in manifest["pages"])
                self.root.after(0, lambda: self.log(f"저장된 항목 수: {total}개"))
                self.root.after(
                    0,
                    lambda: messagebox.showinfo(APP_TITLE, f"완료됐습니다.\n총 {total}개 항목을 저장했어요."),
                )
            except Exception as exc:  # pragma: no cover - UI error path
                self.root.after(0, lambda: self.log(traceback.format_exc()))
                self.root.after(0, lambda: messagebox.showerror(APP_TITLE, f"실행 중 오류가 발생했습니다.\n{exc}"))
            finally:
                self.root.after(0, lambda: self.run_button.config(state="normal"))

        threading.Thread(target=worker, daemon=True).start()


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="PDF에서 검정 볼펜 필기를 투명 PNG로 추출합니다.")
    parser.add_argument("--input", type=Path, help="입력 PDF 경로")
    parser.add_argument("--output", type=Path, help="출력 폴더 경로")
    parser.add_argument("--render-scale", type=float, default=2.0, help="PDF 렌더 배율")
    parser.add_argument("--threshold", type=int, default=180, help="검은 필기 판정 임계값")
    parser.add_argument("--group-gap", type=int, default=115, help="가까운 획을 묶는 거리(px)")
    parser.add_argument("--min-ink-pixels", type=int, default=800, help="최소 잉크 픽셀 수")
    parser.add_argument("--min-component-side", type=int, default=80, help="최소 가로 또는 세로 길이(px)")
    parser.add_argument("--padding", type=int, default=24, help="저장할 때 둘러줄 여백(px)")
    parser.add_argument("--no-individual", action="store_true", help="개별 PNG 저장 안 함")
    parser.add_argument("--no-merged", action="store_true", help="페이지 합본 저장 안 함")
    return parser


def launch_gui() -> None:
    if tk is None:
        raise RuntimeError("현재 Python 환경에 tkinter가 없어 GUI를 띄울 수 없습니다.")
    root = tk.Tk()
    style = ttk.Style(root)
    if "vista" in style.theme_names():
        style.theme_use("vista")
    PenCutoutApp(root)
    root.mainloop()


def run_cli(args: argparse.Namespace) -> None:
    if not args.input:
        raise ValueError("--input 경로가 필요합니다.")

    output = args.output or args.input.with_name(f"{args.input.stem}_pen_cutouts")
    settings = ExtractionSettings(
        render_scale=args.render_scale,
        threshold=args.threshold,
        group_gap=args.group_gap,
        min_ink_pixels=args.min_ink_pixels,
        min_component_side=args.min_component_side,
        padding=args.padding,
        save_individual=not args.no_individual,
        save_merged=not args.no_merged,
    )

    manifest = extract_pdf(args.input, output, settings, log=print)
    total = sum(int(page["item_count"]) for page in manifest["pages"])
    print(f"총 {total}개 항목 저장 완료")


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()

    if args.input:
        run_cli(args)
    else:
        launch_gui()


if __name__ == "__main__":
    main()
