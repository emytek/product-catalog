# Convert Ardova_Solution_Architecture_v2.txt to a formatted Word document
# Georgia font, professional layout

$srcFile  = "C:\Users\NnaemekaOkalla\Documents\Fiori\App\Doc\Ardova_Solution_Architecture_v2.txt"
$destFile = "C:\Users\NnaemekaOkalla\Documents\Fiori\App\Doc\Ardova_Solution_Architecture_v2.docx"

# ── Open Word ──────────────────────────────────────────────────────────────────
$word            = New-Object -ComObject Word.Application
$word.Visible    = $false
$doc             = $word.Documents.Add()
$doc.Styles("Normal").Font.Name = "Georgia"
$doc.Styles("Normal").Font.Size = 11

# Page setup
$doc.PageSetup.TopMargin    = 72
$doc.PageSetup.BottomMargin = 72
$doc.PageSetup.LeftMargin   = 80
$doc.PageSetup.RightMargin  = 72

# Clear the default blank paragraph
$doc.Content.Delete()

# ── Helper: append a paragraph ────────────────────────────────────────────────
function Write-Para {
    param(
        [string]$Text,
        [string]$Font        = "Georgia",
        [int]   $Size        = 11,
        [bool]  $Bold        = $false,
        [bool]  $Italic      = $false,
        [int]   $Align       = 0,        # 0=left 1=center 2=right 3=justify
        [int]   $SpBefore    = 0,
        [int]   $SpAfter     = 6,
        [bool]  $KeepNext   = $false,
        [int]   $LeftIndent  = 0
    )
    $sel = $word.Selection
    $sel.EndKey(6) | Out-Null           # 6=wdStory, move to end

    if ($doc.Paragraphs.Count -gt 0) {
        $sel.TypeParagraph()
    }

    $sel.Font.Reset()
    $sel.Font.Name      = $Font
    $sel.Font.Size      = $Size
    $sel.Font.Bold      = $Bold
    $sel.Font.Italic    = $Italic

    $pf = $sel.ParagraphFormat
    $pf.Alignment       = $Align
    $pf.SpaceBefore     = $SpBefore
    $pf.SpaceAfter      = $SpAfter
    $pf.KeepWithNext    = $KeepNext
    $pf.LeftIndent      = $LeftIndent
    $pf.LineSpacingRule = 0             # 0=wdLineSpaceSingle

    $sel.TypeText($Text)
}

function Insert-PageBreak {
    $sel = $word.Selection
    $sel.EndKey(6) | Out-Null
    $sel.TypeParagraph()
    $sel.InsertBreak(7) | Out-Null     # 7=wdPageBreak
}

function Insert-HRule {
    # Simulate a horizontal rule with a bottom border on the paragraph
    $sel = $word.Selection
    $sel.EndKey(6) | Out-Null
    $sel.TypeParagraph()
    $sel.Font.Name = "Georgia"
    $sel.Font.Size = 4
    $sel.ParagraphFormat.SpaceBefore = 0
    $sel.ParagraphFormat.SpaceAfter  = 0
    $pf = $sel.ParagraphFormat
    $borders = $pf.Borders
    $borders.Item(-3).LineStyle = 1    # -3=wdBorderBottom, 1=wdLineStyleSingle
    $borders.Item(-3).LineWidth = 8    # 0.5pt
    $sel.TypeText(" ")
    # Reset borders for next paragraph
    $sel.TypeParagraph()
    $sel.ParagraphFormat.Borders.Item(-3).LineStyle = 0
}

# ──────────────────────────────────────────────────────────────────────────────
# TITLE PAGE
# ──────────────────────────────────────────────────────────────────────────────
Write-Para ""  -SpAfter 48
Write-Para "ARDOVA ENERGY PLC" -Size 22 -Bold $true -Align 1 -SpBefore 0 -SpAfter 6
Write-Para "TRADE AND SUPPLY MANAGEMENT SYSTEM" -Size 16 -Bold $true -Align 1 -SpAfter 18
Write-Para "Solution Architecture and Technical Design Document" -Size 13 -Align 1 -SpAfter 36

Insert-HRule

foreach ($meta in @(
    "Prepared by   :   WYZE Solutions - SAP Practice",
    "Document Ref  :   WYZE-ARDOVA-SAD-001",
    "Version       :   2.0",
    "Classification:   Confidential - Client Restricted",
    "Date          :   March 2026"
)) {
    Write-Para $meta -Size 11 -Align 1 -SpAfter 3
}

Insert-PageBreak

# ──────────────────────────────────────────────────────────────────────────────
# DOCUMENT CONTROL
# ──────────────────────────────────────────────────────────────────────────────
Write-Para "DOCUMENT CONTROL" -Size 13 -Bold $true -SpBefore 6 -SpAfter 8

# Version table as formatted text block
Write-Para "Version    Date            Author                    Change Description" `
    -Font "Courier New" -Size 9 -Bold $true -SpAfter 1
Write-Para "1.0        March 2026      WYZE SAP Practice         Initial draft" `
    -Font "Courier New" -Size 9 -SpAfter 1
Write-Para "2.0        March 2026      WYZE SAP Practice         Full revision - scoped exclusively to SAP" `
    -Font "Courier New" -Size 9 -SpAfter 1
Write-Para "                                                     S/4HANA Public Cloud Edition. Architecture" `
    -Font "Courier New" -Size 9 -SpAfter 1
Write-Para "                                                     realigned to Clean Core principles." `
    -Font "Courier New" -Size 9 -SpAfter 1
Write-Para "                                                     Removed all on-premise and ECC-specific" `
    -Font "Courier New" -Size 9 -SpAfter 8

Write-Para "Reviewer Sign-Off:" -Size 11 -Bold $true -SpBefore 6 -SpAfter 4
Write-Para "  Solution Architect      : _________________________    Date: __________" -Size 11 -SpAfter 3
Write-Para "  S/4HANA Functional Lead : _________________________    Date: __________" -Size 11 -SpAfter 3
Write-Para "  Client IT Director      : _________________________    Date: __________" -Size 11 -SpAfter 3

Insert-PageBreak

# ──────────────────────────────────────────────────────────────────────────────
# TABLE OF CONTENTS
# ──────────────────────────────────────────────────────────────────────────────
Write-Para "TABLE OF CONTENTS" -Size 13 -Bold $true -SpBefore 6 -SpAfter 12

$toc = @(
    "1.0    Executive Summary",
    "2.0    Scope, Constraints, and Platform Declaration",
    "3.0    Architectural Philosophy - Clean Core on S/4HANA Public Cloud",
    "4.0    High-Level Solution Architecture",
    "5.0    Component 1 - Trade Card (Custom Business Object)",
    "6.0    Component 2 - Trade Finance (Treasury Management)",
    "7.0    Component 3 - Trade Operations (Transportation Management)",
    "8.0    Data Flow and Cross-Component Integration",
    "9.0    SAP BTP - Side-by-Side Extensions and Analytics",
    "10.0   Authorization and Access Control",
    "11.0   Workflow and Approval Design",
    "12.0   Edge Cases and Resilience Design",
    "13.0   Non-Functional Requirements",
    "14.0   Glossary"
)
foreach ($entry in $toc) {
    Write-Para $entry -Size 11 -SpAfter 4
}

Insert-PageBreak

# ──────────────────────────────────────────────────────────────────────────────
# BODY — read and render the source file
# ──────────────────────────────────────────────────────────────────────────────
$lines = Get-Content -Path $srcFile -Encoding UTF8
$total = $lines.Count

# Find where the body starts (first occurrence of "1.0   EXECUTIVE SUMMARY")
$bodyStart = 0
for ($k = 0; $k -lt $total; $k++) {
    if ($lines[$k] -match '^={5,}' -and ($k+1) -lt $total -and $lines[$k+1].Trim() -eq "" -and
        ($k+2) -lt $total -and $lines[$k+2] -match '^\d+\.0\s') {
        $bodyStart = $k
        break
    }
}

$i = $bodyStart
while ($i -lt $total) {
    $raw     = $lines[$i]
    $trimmed = $raw.Trim()

    # ── Footer / end block ─────────────────────────────────────────────────────
    if ($trimmed -match 'This document is the property of WYZE') {
        Insert-PageBreak
        Write-Para "" -SpAfter 60
        Write-Para ("This document is the property of WYZE Solutions and is prepared " +
                    "exclusively for the use of Ardova Energy Plc in connection with the " +
                    "Trade and Supply Management System implementation project. It may not be " +
                    "reproduced, distributed, or disclosed to any third party without the " +
                    "prior written consent of WYZE Solutions.") `
            -Size 10 -Italic $true -Align 1 -SpAfter 8
        Write-Para "WYZE Consulting Services Limited  |  (c) 2026  |  All Rights Reserved" `
            -Size 10 -Bold $true -Align 1
        break
    }

    # ── Section separators (===) ───────────────────────────────────────────────
    if ($trimmed -match '^={10,}$') {
        $i++
        continue
    }

    # ── Blank line ─────────────────────────────────────────────────────────────
    if ($trimmed -eq "") {
        $i++
        continue
    }

    # ── Section heading: "N.0   HEADING IN CAPS" ──────────────────────────────
    if ($trimmed -match '^(\d+)\.0\s{2,}[A-Z]') {
        Write-Para $trimmed -Size 14 -Bold $true -SpBefore 20 -SpAfter 10 -KeepNext $true
        $i++
        continue
    }

    # ── Sub-section heading: "N.N   Title" ────────────────────────────────────
    if ($trimmed -match '^(\d+)\.(\d+)\s{2,}\S') {
        Write-Para $trimmed -Size 12 -Bold $true -SpBefore 14 -SpAfter 5 -KeepNext $true
        $i++
        continue
    }

    # ── Thin rule lines (hyphens or box-drawing horizontal chars) ─────────────
    $isRuleLine = $trimmed -match '^[-]{10,}$'
    if (-not $isRuleLine -and $trimmed.Length -ge 10) {
        $allRule = $true
        foreach ($ch in $trimmed.ToCharArray()) {
            $cp = [int][char]$ch
            if ($cp -ne 0x2500 -and $cp -ne 0x2501 -and $ch -ne '-') {
                $allRule = $false; break
            }
        }
        $isRuleLine = $allRule
    }
    if ($isRuleLine) {
        $i++
        continue
    }

    # ── ASCII diagram / box-drawing lines (detect by char code > 0x2400) ───────
    $hasBoxChars = $false
    foreach ($ch in $raw.ToCharArray()) {
        if ([int][char]$ch -ge 0x2500 -and [int][char]$ch -le 0x25FF) {
            $hasBoxChars = $true; break
        }
    }
    if ($hasBoxChars -or ($trimmed.Length -gt 0 -and $trimmed -match '^\|')) {
        Write-Para $trimmed -Font "Courier New" -Size 8 -SpAfter 1
        $i++
        continue
    }

    # ── All-caps label lines (standalone section labels within a section) ──────
    if ($trimmed -match '^[A-Z][A-Z /\(\)\-]+$' -and
        $trimmed.Length -gt 3 -and $trimmed.Length -lt 80 -and
        $trimmed -notmatch '^[A-Z]{1,3}$') {
        Write-Para $trimmed -Size 11 -Bold $true -SpBefore 10 -SpAfter 4
        $i++
        continue
    }

    # ── Table / aligned data rows (monospace) ─────────────────────────────────
    if ($raw -match '^\s{2,}' -and $trimmed -match '\s{3,}' -and
        $trimmed.Length -lt 120 -and $trimmed -notmatch '^[-]' -and
        $trimmed -match '^[A-Z\(]') {
        Write-Para $trimmed -Font "Courier New" -Size 9 -SpAfter 1
        $i++
        continue
    }

    # ── Bullet points: lines starting with em-dash (U+2014) or hyphen ─────────
    $firstChar = if ($trimmed.Length -gt 0) { [int][char]$trimmed[0] } else { 0 }
    if ($firstChar -eq 0x2014 -or ($trimmed -match '^[-]+\s+\S')) {
        $bulletBody = $trimmed -replace '^[\u2014\-]+\s*', ''
        $bullet = "    - " + $bulletBody
        Write-Para $bullet -Size 11 -SpAfter 3 -LeftIndent 14
        $i++
        continue
    }

    # ── Code / example lines (indented, starts with lowercase or symbol) ───────
    if ($raw -match '^\s{4,}' -and $trimmed -match '^[a-z_]') {
        Write-Para $trimmed -Font "Courier New" -Size 9 -SpAfter 1 -LeftIndent 14
        $i++
        continue
    }

    # ── Regular body paragraph ─────────────────────────────────────────────────
    if ($trimmed.Length -gt 0) {
        Write-Para $trimmed -Size 11 -SpAfter 6 -Align 3   # 3=justify
    }

    $i++
}

# ── Save and close ─────────────────────────────────────────────────────────────
$doc.SaveAs([ref]$destFile, [ref]16)
$doc.Close($false)
$word.Quit()

[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect()
[GC]::WaitForPendingFinalizers()

Write-Host "SUCCESS: Document saved to $destFile"
