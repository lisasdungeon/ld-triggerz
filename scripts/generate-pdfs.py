#!/usr/bin/env python3
"""Generate LD-branded PDF collateral for LD Triggerz."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
PDFS = ROOT

STYLES = getSampleStyleSheet()

TITLE = ParagraphStyle(
    "LDTitle",
    parent=STYLES["Title"],
    fontSize=24,
    leading=28,
    textColor=colors.HexColor("#d34b4b"),
    spaceAfter=18,
)

HEADING = ParagraphStyle(
    "LDHeading",
    parent=STYLES["Heading2"],
    fontSize=16,
    leading=20,
    textColor=colors.HexColor("#d34b4b"),
    spaceAfter=10,
    spaceBefore=14,
)

BODY = ParagraphStyle(
    "LDBody",
    parent=STYLES["BodyText"],
    fontSize=11,
    leading=15,
    spaceAfter=8,
)

BULLET = ParagraphStyle(
    "LDBullet",
    parent=STYLES["BodyText"],
    fontSize=11,
    leading=15,
    leftIndent=18,
    bulletIndent=8,
    spaceAfter=4,
)

FOOTER = ParagraphStyle(
    "LDFooter",
    parent=STYLES["BodyText"],
    fontSize=9,
    textColor=colors.grey,
    alignment=1,
    spaceBefore=20,
)


def build_pdf(filename, title, elements, footer=None):
    pdf_path = PDFS / filename
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    story = [Paragraph(title, TITLE), Spacer(1, 6)]
    for element in elements:
        if isinstance(element, str):
            story.append(Paragraph(element, BODY))
        else:
            story.append(element)
    if footer:
        story.append(Spacer(1, 12))
        story.append(Paragraph(footer, FOOTER))
    doc.build(story)
    print(f"Generated {pdf_path}")


def how_to_guide():
    title = "LD Triggerz<br/>How to Guide"
    elements = [
        "v1.0.3 - Foundry VTT v13 / v14 - System Agnostic",
        Spacer(1, 12),
        "This guide walks you through installing the module, opening the GM Hub, building your first condition, setting up a trigger, and linking the two together so your table runs without you having to stop the game to manage status effects.",
        "1. Installation",
        "LD Triggerz is a release from Lisa's Dungeon. Download the zip from the release post and install it through Foundry's module manager.",
        "Steps:",
        "Log into Foundry and open the Add-on Modules tab.",
        "Click Install Module.",
        "At the bottom of the dialog, paste the manifest URL or click the upload icon to install from the zip directly.",
        "Once installed, enable LD Triggerz in your world's Module Management settings.",
        "Reload the page when prompted.",
        "The module works on any game system. There are no dependencies.",
        "2. Opening the GM Hub",
        "Everything in LD Triggerz runs through the GM Hub. You have two ways to open it.",
        "Scene Control Button: Look at the left-side scene controls toolbar in Foundry. There is a bolt icon labeled Open LD Triggerz. Click it to open the hub. If you don't see it, check that the scene control is enabled in Configure Settings under the LD Triggerz section.",
        "Configure Settings: Open Configure Settings, find the LD Triggerz section, and click Open GM Hub. This works even if you have the scene control button turned off.",
        "The hub shows a live count of your triggers, conditions, and currently selected tokens at the top.",
        "3. Understanding the Layout",
        "The GM Hub has four main areas:",
        "Selected Tokens - shows tokens you have selected on the canvas, their assigned conditions, and buttons to apply, remove, toggle, assign, or unassign conditions on them directly.",
        "Condition Builder - a form on the left side for creating and saving custom conditions.",
        "Trigger Builder - a form on the right side for creating rules that fire when actor or token data changes.",
        "Configured Conditions and Configured Triggers - the lists at the bottom showing everything you have saved, with delete buttons.",
        "Advanced Import / Export is a collapsible section at the very bottom for backing up and sharing your setup as JSON.",
        "4. Building a Condition",
        "A condition in LD Triggerz is the thing that gets applied to an actor. It can be a native Foundry status effect, a Custom System Builder status, or a fully custom homebrew condition with its own ActiveEffect changes.",
        "Using a Foundry or CSB Status: If the condition you want already exists as a Foundry status effect or CSB status, just pick it from the Foundry/CSB Status dropdown. The ID and name fill in automatically. Hit Save Condition and you're done.",
        "Creating a Custom Condition:",
        "Leave the status dropdown on Custom status.",
        "Type a Condition ID - keep it lowercase with hyphens, for example bloodied or near-death. This is the internal key.",
        "Type a Condition Name - this is what shows in the UI, for example Bloodied.",
        "Set an Icon Path if you want a specific icon. The default is icons/svg/aura.svg.",
        "Add a Description if it helps you remember what the condition does.",
        "Click Save Condition.",
        "Advanced Effect Changes: Expand the Advanced Effect Changes section if you want the condition to modify actor data through Foundry's ActiveEffect system. Each row needs:",
        "Key - the actor data path to modify, for example system.attributes.hp.value",
        "Mode - Add, Multiply, Override, Downgrade, Upgrade, or Custom",
        "Value - the number or path to use. For CSB paths like system.props.HP, the math is handled automatically.",
        "Priority - controls the order when multiple effects stack. Default is 20.",
        "CSB users: entering system.props.HP as the key and a number as the value with Add mode will automatically produce the correct CSB formula. You do not need to write the formula yourself.",
        "5. Building a Trigger",
        "A trigger is a rule that watches for a specific change in actor or token data. When the condition is met, it fires and runs whatever action you assigned.",
        "The Fields:",
        "Trigger Name - a label for your own reference, for example HP Zero Check.",
        "Trigger ID - auto-generated from the name and path if you leave it blank. You can set your own.",
        "Actor Path - the data path to watch. Pick a common one from the dropdown or type a custom path.",
        "Custom Path - if you type here it overrides the dropdown. Use dot notation, for example system.hp.value.",
        "Operator - how to compare the value. Options are Equals, Does not equal, Less than, Less than or equal, Greater than, Greater than or equal.",
        "Value - what to compare against. Can be a number, a percentage like 50%, or another actor data path.",
        "Compare Path - used with percentage values. If your value is 50% and your compare path is system.hp.max, the trigger fires when HP is below half of max.",
        "Scope - All actors, PC actors only, or NPC actors only.",
        "Ignore Zero - tick this to stop the trigger from firing when the value is exactly 0. Useful for preventing loops on death.",
    ]
    build_pdf(
        "ld-triggerz-how-to-guide.pdf",
        title,
        elements,
        "Lisa's Dungeon - https://patreon.com/LisasDungeon",
    )


def patreon_post():
    title = "LD Triggerz - v1.0.3"
    elements = [
        "Exclusive Release",
        "Hey everyone - thank you for the support. This one has been in the works for a while and I'm glad to finally get it in your hands.",
        "LD Triggerz is a system-agnostic automation module for Foundry VTT. The short version: you define when something should happen, and what should happen when it does. HP drops below half? Apply Bloodied. HP hits zero? Apply Unconscious. Stat recovers? Remove the condition automatically. All of it configured through a GM Hub UI directly inside Foundry - no code, no macros required unless you want them.",
        "What's in v1.0.3:",
        "GM Hub with visual Trigger Builder and Condition Builder",
        "Full Foundry ActiveEffect support - modes, changes, priority",
        "Condition linking - wire a condition to an apply trigger and a remove trigger so full workflows run on their own",
        "Custom System Builder path normalization for system.props attributes",
        "Percentage-based comparisons - for example HP less than 25% of max",
        "Scope filtering: all actors, PC only, NPC only",
        "Actor path value comparisons - compare one stat against another",
        "Import and Export for saving and sharing your automation setups",
        "Scene control launcher and settings menu access",
        "Foundry v13 and v14 support",
        "System agnostic - works with any game system",
        "How to Install: Download the zip from this post and install manually through Foundry's Add-on Module manager. Use Install Module and either paste the manifest URL or upload the zip directly.",
        "This release is exclusive to Lisa's Dungeon supporters. If you find bugs or want to share how you're using it, drop a comment below - I read everything. More coming. Thank you.",
    ]
    build_pdf(
        "ld-triggerz-patreon-post.pdf",
        title,
        elements,
        "Lisa's Dungeon - https://patreon.com/LisasDungeon",
    )


def promo():
    title = "LD TRIGGERZ"
    elements = [
        "Trigger-driven automation for Foundry VTT - built for GMs who want their table to run itself.",
        "Set the Rule. Forget the Busywork.",
        "Define when something happens. LD Triggerz handles the rest.",
        "HP drops below half - Bloodied applies automatically.",
        "HP hits zero - Unconscious fires. Zero-skip keeps it clean.",
        "Stat recovers above the line - the condition lifts on its own.",
        "No macros. No scripts. No interrupting the game to manage status effects by hand.",
        "The GM Hub",
        "One window. Full control. Build triggers, build conditions, link them together, manage selected tokens - all from inside Foundry. No JSON, no external tools. Select a token, assign a condition, watch your automation rules work live at the table.",
        "Built for Any Table:",
        "System agnostic - Foundry v13 and v14 ready",
        "Custom System Builder support with native system.props path math",
        "Percentage comparisons and scope filters",
        "Macro integration for when you need that extra step",
        "Import and export your full configuration as JSON - take your setups anywhere",
        "Available now from Lisa's Dungeon.",
    ]
    build_pdf(
        "ld-triggerz-promo.pdf",
        title,
        elements,
        "Lisa's Dungeon - https://patreon.com/LisasDungeon",
    )


def reddit_post():
    title = "LD Triggerz"
    elements = [
        "Release - System-Agnostic Trigger Automation for Foundry VTT v13/v14",
        "Hey everyone. Dropping this for supporters first before any public release. LD Triggerz is now live.",
        "What it does: LD Triggerz is a trigger-driven automation module for Foundry VTT. You define rules that watch actor and token data - HP drops below a threshold, a stat hits zero, a value crosses a percentage - and the module fires automatically. Apply a condition, remove it, toggle it, or run a macro. No scripting required.",
        "Key Features:",
        "Visual GM Hub - build triggers and conditions directly in-game through a clean UI, no JSON editing needed",
        "Condition Builder with full Foundry ActiveEffect support - set attribute changes, modes, and priority right from the hub",
        "Condition linking - wire a condition to an Apply Trigger and a Remove Trigger so the whole workflow runs hands-free",
        "CSB support - Custom System Builder users get native system.props path math",
        "Scope filtering - fire only on PCs, only on NPCs, or on everything",
        "Percentage comparisons - trigger when HP drops below 25% of max, not just a raw number",
        "Import and Export - save and share your entire trigger and condition configuration as JSON",
        "System agnostic - runs on any Foundry system with no dependencies",
        "Foundry v13 and v14 compatible",
        "Example Use Cases:",
        "Auto-apply Bloodied when HP hits 50%",
        "Auto-apply Unconscious when HP reaches 0 - zero-skip keeps it from looping",
        "Auto-remove a condition when a stat recovers above a threshold",
        "Fire a macro when a specific actor path changes",
        "This is a release from Lisa's Dungeon. If you're a supporter, grab it from the post. Feedback is welcome - especially from anyone running unusual systems who wants to stress-test the CSB path handling.",
    ]
    build_pdf(
        "ld-triggerz-reddit-post.pdf",
        title,
        elements,
        "Lisa's Dungeon - https://patreon.com/LisasDungeon",
    )


if __name__ == "__main__":
    PDFS.mkdir(parents=True, exist_ok=True)
    how_to_guide()
    patreon_post()
    promo()
    reddit_post()
    print("All PDFs generated.")
