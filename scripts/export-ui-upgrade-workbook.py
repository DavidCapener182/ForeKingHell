#!/usr/bin/env python3
"""Create the review workbook from the authoritative CSV; never modify the CSV."""
import csv
from datetime import datetime
from pathlib import Path

import xlsxwriter

root = Path(__file__).resolve().parents[1]
rows = list(csv.DictReader((root / "ForeKingHell-completion-tracker.csv").open(newline="")))
routes = list(csv.DictReader((root / "ForeKingHell-route-coverage.csv").open(newline="")))
target = root / "ForeKingHell-completion-tracker.xlsx"
workbook = xlsxwriter.Workbook(target)
title = workbook.add_format({"font_name": "Aptos", "font_size": 22, "bold": True, "font_color": "123D2B"})
heading = workbook.add_format({"font_name": "Aptos", "bold": True, "bg_color": "123D2B", "font_color": "FFFFFF", "text_wrap": True})
body = workbook.add_format({"font_name": "Aptos", "font_size": 11, "valign": "top", "text_wrap": True})
number = workbook.add_format({"font_name": "Aptos", "font_size": 16, "bold": True, "num_format": "0"})
note = workbook.add_format({"font_name": "Aptos", "font_color": "59665E", "text_wrap": True, "valign": "top"})
status_formats = {
    "Implemented; partial verification": workbook.add_format({"bg_color": "FFF0C2", "font_color": "755100"}),
    "In progress (concurrent redesign)": workbook.add_format({"bg_color": "DBEAFA", "font_color": "194D7D"}),
    "In progress": workbook.add_format({"bg_color": "DBEAFA", "font_color": "194D7D"}),
    "Not started": workbook.add_format({"bg_color": "EDF0EE", "font_color": "59665E"}),
    "Passed": workbook.add_format({"bg_color": "DDF2E5", "font_color": "175A35"}),
}
summary = workbook.add_worksheet("Progress summary")
summary.hide_gridlines(2)
summary.set_column("A:A", 42)
summary.set_column("B:C", 20)
summary.set_column("D:F", 18)
summary.merge_range("A1:F2", "ForeKingHell · UI upgrade progress", title)
summary.merge_range("A4:F4", f"Snapshot: {datetime.now().astimezone().strftime('%d %B %Y, %H:%M %Z')}", note)
summary.merge_range("A6:F7", "UI-first delivery: implemented UI is shown first below. Acceptance is tracked separately and remains pending until its checks pass. Filter Components or open Work touched for the exact changes and evidence. Source: ForeKingHell-completion-tracker.csv.", note)
summary.write_row("A9", ["Status", "Desktop", "Mobile"], heading)
last = len(rows) + 1
for row_index, status in enumerate(status_formats, start=9):
    summary.write(row_index, 0, "UI implemented · checks pending" if status == "Implemented; partial verification" else "Acceptance passed" if status == "Passed" else status, body)
    for column_index, viewport, excel_column in [(1, "desktop", "E"), (2, "mobile", "F")]:
        count = sum(row[viewport + "_status"] == status for row in rows)
        summary.write_formula(row_index, column_index, f'=COUNTIF(Components!{excel_column}2:{excel_column}{last},"{status}")', number, count)
summary.write("A15", "Components passed on both surfaces", body)
summary.write_formula("B15", f'=COUNTIFS(Components!E2:E{last},"Passed",Components!F2:F{last},"Passed")', number, sum(row["desktop_status"] == row["mobile_status"] == "Passed" for row in rows))
summary.write("A16", "Total components", body)
summary.write_formula("B16", f'=COUNTA(Components!A2:A{last})', number, len(rows))
summary.write("A17", "Documented routes", body)
summary.write_formula("B17", f'=COUNTA(Routes!A2:A{len(routes)+1})', number, len(routes))
summary.merge_range("A20:F22", "Read the Desktop evidence, Mobile evidence and Blockers columns before treating a component as finished. Workbook values are refreshed by scripts/export-ui-upgrade-workbook.py; edits here do not write back to the CSV.", note)
summary.write_url("A24", "internal:'Components'!A1", string="Open all components")
summary.write_url("A25", "internal:'Work touched'!A1", string="Open work touched so far")
summary.freeze_panes(8, 0)

fields = ["component_id", "route", "component", "priority", "desktop_status", "mobile_status", "desktop_evidence", "mobile_evidence", "blocker", "acceptance", "source_files", "untitled_ui"]
labels = ["Component ID", "Route", "Component", "Priority", "Desktop status", "Mobile status", "Desktop evidence", "Mobile evidence", "Blockers / outstanding checks", "Acceptance", "Source files", "Untitled UI reference"]

def component_sheet(name, data):
    sheet = workbook.add_worksheet(name)
    sheet.hide_gridlines(2)
    sheet.freeze_panes(1, 3)
    sheet.set_column("A:A", 16, body)
    sheet.set_column("B:B", 29, body)
    sheet.set_column("C:C", 42, body)
    sheet.set_column("D:D", 10, body)
    sheet.set_column("E:F", 29, body)
    sheet.set_column("G:J", 65, body)
    sheet.set_column("K:L", 60, body)
    sheet.set_row(0, 32)
    for row_index in range(1, len(data) + 1):
        sheet.set_row(row_index, 72)
    sheet.add_table(0, 0, len(data), len(fields)-1, {"columns": [{"header": label, "header_format": heading} for label in labels], "data": [[row[field] for field in fields] for row in data], "style": "Table Style Medium 4"})
    for status, style in status_formats.items():
        sheet.conditional_format(1, 4, len(data), 5, {"type": "cell", "criteria": "==", "value": f'"{status}"', "format": style})
    sheet.set_landscape()
    sheet.fit_to_pages(1, 0)
    sheet.repeat_rows(0)

component_sheet("Components", rows)
component_sheet("Work touched", [row for row in rows if row["desktop_status"] != "Not started" or row["mobile_status"] != "Not started"])
route_sheet = workbook.add_worksheet("Routes")
route_sheet.freeze_panes(1, 2)
route_sheet.hide_gridlines(2)
route_sheet.set_column("A:A", 12, body)
route_sheet.set_column("B:D", 38, body)
route_sheet.set_column("E:K", 45, body)
route_sheet.add_table(0, 0, len(routes), len(routes[0])-1, {"columns": [{"header": field.replace("_", " ").title(), "header_format": heading} for field in routes[0]], "data": [list(row.values()) for row in routes], "style": "Table Style Medium 4"})
workbook.close()
print(target)
