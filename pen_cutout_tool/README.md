# 볼펜 필기 누끼 추출기

PDF 안에서 검정 볼펜으로 적힌 체크, 이름, 메모 같은 부분만 골라서 투명 배경 PNG로 저장하는 도구입니다.

## 실행

GUI:

```powershell
python C:\Users\GS002\Documents\codex\pen_cutout_tool\app.py
```

CLI:

```powershell
python C:\Users\GS002\Documents\codex\pen_cutout_tool\app.py --input "D:\총무2026\사용인감\stamps.pdf"
```

## 결과물

- `page_01_all.png`: 한 페이지의 필기를 한 장으로 합친 투명 PNG
- `page_01/page_01_item_01.png`: 체크표시나 이름처럼 분리된 개별 항목 PNG
- `manifest.json`: 저장 경로와 페이지별 결과 요약

## 옵션 팁

- `어두움 임계값`: 높이면 더 연한 필기까지 잡고, 낮추면 진한 필기만 남습니다.
- `글자 묶기 거리(px)`: 체크 여러 획이나 이름 글자가 따로 저장되면 값을 조금 올리면 됩니다.
- `최소 잉크 픽셀`: 잡티가 섞이면 값을 조금 올리면 됩니다.
