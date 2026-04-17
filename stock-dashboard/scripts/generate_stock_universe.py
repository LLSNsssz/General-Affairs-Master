import json
from pathlib import Path

import FinanceDataReader as fdr


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps" / "web" / "lib" / "market" / "universe.generated.json"


def build_kr_entries():
    listing = fdr.StockListing("KRX")
    market_to_suffix = {
        "KOSPI": ".KS",
        "KOSDAQ": ".KQ",
        "KONEX": ".KQ",
    }
    entries = []

    for row in listing.to_dict("records"):
        market = str(row.get("Market") or "").upper()
        code = str(row.get("Code") or "").strip()
        name = str(row.get("Name") or "").strip()
        suffix = market_to_suffix.get(market)
        if not suffix or len(code) != 6 or not name:
            continue

        entries.append(
            {
                "market": "KR",
                "symbol": code,
                "name": name,
                "exchange": market,
                "yahooSymbol": f"{code}{suffix}",
            }
        )

    return entries


def build_us_entries(exchange: str):
    listing = fdr.StockListing(exchange)
    entries = []

    for row in listing.to_dict("records"):
        symbol = str(row.get("Symbol") or "").strip().upper()
        name = str(row.get("Name") or "").strip()
        if not symbol or not name:
            continue

        entries.append(
            {
                "market": "US",
                "symbol": symbol,
                "name": name,
                "exchange": exchange,
                "yahooSymbol": symbol,
            }
        )

    return entries


def dedupe(entries):
    deduped = {}
    for entry in entries:
        key = f"{entry['market']}:{entry['symbol']}"
        deduped[key] = entry
    return list(deduped.values())


def main():
    universe = dedupe(
        [
            *build_kr_entries(),
            *build_us_entries("NASDAQ"),
            *build_us_entries("NYSE"),
            *build_us_entries("AMEX"),
        ]
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(universe, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"generated {len(universe)} entries -> {OUTPUT}")


if __name__ == "__main__":
    main()
