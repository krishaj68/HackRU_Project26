"""
Academic Workload & Note Management App  (HackRU demo)
=======================================================

A student dashboard that can
  * import assignment deadlines from a Canvas iCal (.ics) feed,
  * "import" Canvas courses / assignments / files via an access token (mock data),
  * organise notes in  Semester folder -> Class -> Unit -> Note,
  * chat with an AI helper panel inside every class.

Storage
-------
Everything lives in a per-browser "state" dict that is looked up through the
Flask `session` (the session holds only a small random id).  Why not put the
whole state in the session cookie itself?  Flask cookies are limited to ~4 KB,
which a handful of notes or one real Canvas calendar would blow past.
The state is kept in memory, so it disappears when the server restarts
(or when you press "Reset demo data").  No database needed.

Run:  python main.py   ->  http://localhost:5000
"""

import hashlib
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from itertools import groupby
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from flask import (Flask, abort, flash, jsonify, redirect, render_template,
                   request, session, url_for)
from icalendar import Calendar

# Times in the calendar feed are converted to this zone (Rutgers = New York).
try:
    from zoneinfo import ZoneInfo
    LOCAL_TZ = ZoneInfo("America/New_York")
except Exception:  # tzdata missing -> fall back to UTC instead of crashing
    LOCAL_TZ = timezone.utc

app = Flask(__name__)
app.secret_key = "hackru-demo-secret-change-me"  # fine for a demo only

# --------------------------------------------------------------------------
# Demo configuration
# --------------------------------------------------------------------------
SEMESTERS = ["Fall Sem 25", "Spring Sem 26", "Fall Sem 26"]
DEFAULT_CLASSES = ["Class1", "Class2", "Class3", "Class4", "Class5"]
UNITS = ["Unit1", "Unit2", "Unit3", "Unit4", "Unit5"]
CLASS_MENU = ["Import"] + UNITS          # left menu on the class page
MAX_ICAL_BYTES = 5 * 1024 * 1024         # refuse feeds bigger than 5 MB
MAX_NOTE_CHARS = 50_000
MAX_NAME_LEN = 40
EXAM_RE = re.compile(r"\b(exam|midterm|final exam)\b", re.IGNORECASE)


# --------------------------------------------------------------------------
# State handling (session-backed, in memory)
# --------------------------------------------------------------------------
_STORE = {}  # session id -> state dict


def new_class():
    """A class has 5 units; each unit holds one note called Note1."""
    return {"units": {u: {"note_title": "Note1", "content": ""} for u in UNITS}}


def default_state():
    return {
        "name": "Student",
        "folders": {s: {"classes": {c: new_class() for c in DEFAULT_CLASSES}}
                    for s in SEMESTERS},
        "events": [],        # parsed iCal items
        "ical_skipped": 0,   # how many broken calendar items were skipped
        "canvas": None,      # mock Canvas data after token import
        "done": [],          # ids of to-do items that are ticked off
        "chats": {},         # "folder|class" -> list of chat messages
    }


def get_state():
    """Return this visitor's state, creating it on the first request."""
    sid = session.get("sid")
    if sid not in _STORE:
        sid = uuid.uuid4().hex
        session["sid"] = sid
        _STORE[sid] = default_state()
    return _STORE[sid]


def find_class(state, folder_name, class_name):
    """Look up a class dict. If folder_name is missing/unknown, search all folders."""
    folder = state["folders"].get(folder_name)
    if folder and class_name in folder["classes"]:
        return folder_name, folder["classes"][class_name]
    for fname, f in state["folders"].items():
        if class_name in f["classes"]:
            return fname, f["classes"][class_name]
    return None, None


def clean_name(raw):
    """Validate a user-typed folder/class name. Returns (name, error)."""
    name = " ".join((raw or "").split())
    if not name:
        return None, "Please enter a name."
    if len(name) > MAX_NAME_LEN:
        return None, f"Names can be at most {MAX_NAME_LEN} characters."
    if any(ch in name for ch in "/\\?#%"):
        return None, "Names can't contain / \\ ? # or %."
    return name, None


# --------------------------------------------------------------------------
# Date / event helpers
# --------------------------------------------------------------------------
def now_local():
    return datetime.now(LOCAL_TZ).replace(tzinfo=None)


def fmt_time(dt):
    return dt.strftime("%I:%M %p").lstrip("0")


def fmt_day(d):
    return f"{d.strftime('%a, %b')} {d.day}, {d.year}"


def to_local(value):
    """
    Turn an iCal date/datetime into a naive local datetime.
    EDGE CASE: all-day events give a plain `date` (not a datetime) -> midnight.
    EDGE CASE: timezone-aware datetimes are converted to LOCAL_TZ.
    """
    if isinstance(value, datetime):  # check first: datetime is a subclass of date
        if value.tzinfo is not None:
            value = value.astimezone(LOCAL_TZ).replace(tzinfo=None)
        return value
    return datetime.combine(value, datetime.min.time())


def make_item(item_id, title, course, start, end, all_day, source):
    """Build the one dict shape used everywhere (iCal events and Canvas assignments)."""
    if all_day:
        time_label = "All day"
        if end:
            time_label += f" (through {end.strftime('%b')} {end.day})"
    else:
        time_label = fmt_time(start)
        if end:  # only shown when the feed actually had an end time
            time_label += " – " + (fmt_time(end) if end.date() == start.date()
                                   else f"{end.strftime('%b')} {end.day}, {fmt_time(end)}")
    return {
        "id": item_id,
        "title": title,
        "course": course,
        "day": start.date().isoformat(),
        "day_label": fmt_day(start.date()),
        "time_label": time_label,
        "all_day": all_day,
        "has_end": end is not None,
        "is_exam": bool(EXAM_RE.search(title)),
        "sort": start.isoformat(),
        "source": source,
    }


def normalise_event(comp):
    """
    Convert one VEVENT into an item dict, or return None if it has no usable date.
    Any exception raised here is caught by parse_ical(), which skips the event.
    """
    dtstart = comp.get("dtstart")
    dtend = comp.get("dtend")
    start_raw = dtstart.dt if dtstart is not None else None
    end_raw = dtend.dt if dtend is not None else None

    if start_raw is None and end_raw is None:
        return None                      # nothing to sort by -> skip
    if start_raw is None:                # EDGE CASE: missing dtstart, use dtend
        start_raw, end_raw = end_raw, None

    all_day = not isinstance(start_raw, datetime)
    start = to_local(start_raw)

    end = None                           # EDGE CASE: missing dtend stays None
    if end_raw is not None:
        end = to_local(end_raw)
        if all_day:                      # iCal all-day DTEND is exclusive (next day)
            end -= timedelta(days=1)
        same_or_before = end.date() <= start.date() if all_day else end <= start
        if same_or_before:               # single-day or nonsensical range
            end = None

    summary = str(comp.get("summary") or "Untitled event").strip()
    # Canvas titles look like "Homework 3 [CS111-Fall]" -> split off the course tag
    course = ""
    match = re.match(r"^(.*?)\s*\[(.+)\]\s*$", summary)
    if match:
        summary, course = match.group(1) or summary, match.group(2)

    uid = str(comp.get("uid") or summary)
    item_id = hashlib.sha1((uid + start.isoformat()).encode()).hexdigest()[:10]
    return make_item(item_id, summary, course, start, end, all_day, "ical")


def parse_ical(raw):
    """Parse raw .ics bytes -> (sorted list of items, number of skipped events)."""
    cal = Calendar.from_ical(raw)        # raises ValueError if it isn't a calendar
    items, skipped, seen = [], 0, set()
    for comp in cal.walk("VEVENT"):
        try:
            item = normalise_event(comp)
        except Exception:                # broken item: skip it, never crash the site
            skipped += 1
            continue
        if item is None:
            skipped += 1
        elif item["id"] not in seen:     # drop exact duplicates
            seen.add(item["id"])
            items.append(item)
    items.sort(key=lambda i: i["sort"])
    return items, skipped


def fetch_ical(url):
    """Download an .ics feed. Raises ValueError/OSError with a friendly reason."""
    if url.lower().startswith("webcal://"):   # webcal:// is just https:// in disguise
        url = "https://" + url[len("webcal://"):]
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Please enter a full http(s):// or webcal:// link.")
    req = Request(url, headers={"User-Agent": "WorkloadApp/1.0"})
    with urlopen(req, timeout=10) as resp:
        data = resp.read(MAX_ICAL_BYTES + 1)
    if len(data) > MAX_ICAL_BYTES:
        raise ValueError("That calendar file is too large (5 MB limit).")
    return data


def group_by_day(items):
    """Group sorted items by day for the 'Assignments Per Day' card."""
    today = now_local().date().isoformat()
    groups = []
    for day, grp in groupby(sorted(items, key=lambda i: i["sort"]), key=lambda i: i["day"]):
        entries = list(grp)
        groups.append({"day": day, "label": entries[0]["day_label"],
                       "past": day < today, "today": day == today, "entries": entries})
    return groups


def exam_countdown(items):
    """Upcoming items whose title looks like an exam, with days remaining."""
    today = now_local().date()
    exams = []
    for i in sorted(items, key=lambda i: i["sort"]):
        if i["is_exam"]:
            days = (date.fromisoformat(i["day"]) - today).days
            if days >= 0:
                exams.append({**i, "days_left": days})
    return exams


def build_mock_canvas(token):
    """
    Stand-in for the real Canvas API (GET /api/v1/courses etc.).
    A real version would call https://<school>.instructure.com/api/v1/... with
    the header  Authorization: Bearer <token>.  The token is NOT stored.
    """
    base = now_local().replace(second=0, microsecond=0)

    def due(days, hour=23, minute=59):
        return (base + timedelta(days=days)).replace(hour=hour, minute=minute)

    def a(n, title, course, when):
        return make_item(f"canvas-{n}", title, course, when, None, False, "canvas")

    return {
        "token_hint": "…" + token[-4:],
        "courses": [
            {"code": "CS111", "name": "Intro to Computer Science"},
            {"code": "MATH152", "name": "Calculus II"},
            {"code": "PHYS203", "name": "General Physics"},
            {"code": "ENG101", "name": "Expository Writing"},
            {"code": "PSY101", "name": "Intro to Psychology"},
        ],
        "assignments": [
            a(1, "Problem Set 3", "CS111", due(1)),
            a(2, "Lab Report 2", "PHYS203", due(2, 17, 0)),
            a(3, "Integration Quiz", "MATH152", due(3, 9, 30)),
            a(4, "Essay Draft", "ENG101", due(4)),
            a(5, "Reading Response 4", "PSY101", due(5)),
            a(6, "Midterm Exam", "CS111", due(9, 10, 0)),
            a(7, "Project Proposal", "CS111", due(12)),
        ],
        "files": [
            {"name": "CS111 – Lecture 5 Slides.pdf", "course": "CS111", "size": "2.1 MB"},
            {"name": "MATH152 – Series Cheat Sheet.pdf", "course": "MATH152", "size": "480 KB"},
            {"name": "PHYS203 – Lab 2 Instructions.docx", "course": "PHYS203", "size": "96 KB"},
            {"name": "ENG101 – Essay Rubric.pdf", "course": "ENG101", "size": "210 KB"},
            {"name": "PSY101 – Chapter 4 Notes.pdf", "course": "PSY101", "size": "1.3 MB"},
        ],
    }


def all_items(state):
    """iCal events + mock Canvas assignments, used by To Do and Exams."""
    canvas = state["canvas"]["assignments"] if state["canvas"] else []
    return state["events"] + canvas


# --------------------------------------------------------------------------
# AI chat helper (mock)
# --------------------------------------------------------------------------
def generate_reply(message, note, class_name):
    """
    Tiny rule-based stand-in for an LLM so the demo works with no API key.
    To use a real model, replace this function's body with an API call that
    sends `message` plus `note` as context (keep keys in environment variables,
    never in the code).
    """
    msg = message.lower()
    if not note.strip():
        return (f"I don't see any notes for {class_name} yet. Write something in "
                "the editor, then ask me to summarize it or quiz you.")
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", note) if len(s.strip()) > 15]
    if "summar" in msg:
        picks = sentences[:3] or [note.strip()[:200]]
        return "Quick summary:\n" + "\n".join(f"• {p}" for p in picks)
    if "quiz" in msg or "question" in msg or "test me" in msg:
        if not sentences:
            return "Your note is too short to quiz on. Add a few full sentences first."
        qs = [f'{n}. Explain in your own words: "{" ".join(s.split()[:10])}…"'
              for n, s in enumerate(sentences[:3], 1)]
        return "Quiz time:\n" + "\n".join(qs)
    return (f"Your note has about {len(note.split())} words. "
            'Try "summarize my notes" or "quiz me".')


# --------------------------------------------------------------------------
# Routes: Imports (home), To Do, Exams
# --------------------------------------------------------------------------
@app.route("/")
def index():
    state = get_state()
    return render_template(
        "index.html",
        name=state["name"],
        groups=group_by_day(state["events"]),
        exams=exam_countdown(all_items(state)),
        canvas=state["canvas"],
        skipped=state["ical_skipped"],
        has_events=bool(state["events"]),
    )


@app.post("/import/token")
def import_token():
    state = get_state()
    token = request.form.get("token", "").strip()
    if len(token) < 8:  # demo check only; real tokens are ~70 characters
        flash("Paste your Canvas access token (at least 8 characters).", "error")
        return redirect(url_for("index"))
    state["canvas"] = build_mock_canvas(token)
    state["name"] = "Alex"  # a real app would read this from /api/v1/users/self
    flash("Loaded 5 courses, 7 assignments and 5 files (demo data).", "success")
    return redirect(url_for("index"))


@app.post("/import/ical")
def import_ical():
    state = get_state()
    url = request.form.get("ical_url", "").strip()
    if not url:
        flash("Paste your Canvas calendar feed (.ics) link.", "error")
        return redirect(url_for("index"))
    try:
        items, skipped = parse_ical(fetch_ical(url))
    except ValueError as exc:
        flash(f"Couldn't read that calendar: {exc}", "error")
    except OSError as exc:  # network errors, HTTP errors, timeouts
        flash(f"Couldn't download the calendar ({exc}). Check the link and try again.", "error")
    except Exception:
        flash("That link didn't return a valid calendar file.", "error")
    else:
        state["events"], state["ical_skipped"] = items, skipped
        if items:
            msg = f"Imported {len(items)} events."
            if skipped:
                msg += f" Skipped {skipped} broken item(s)."
            flash(msg, "success")
        else:
            flash("The calendar loaded but had no events with dates.", "error")
    return redirect(url_for("index"))


@app.route("/todo")
def todo_page():
    state = get_state()
    items = all_items(state)
    done = set(state["done"])
    return render_template("todo.html", groups=group_by_day(items), done=done,
                           total=len(items), finished=sum(1 for i in items if i["id"] in done))


@app.post("/todo/toggle/<item_id>")
def todo_toggle(item_id):
    done = get_state()["done"]
    if item_id in done:
        done.remove(item_id)
    else:
        done.append(item_id)
    return redirect(url_for("todo_page"))


@app.route("/exams")
def exams_page():
    state = get_state()
    return render_template("exams.html", exams=exam_countdown(all_items(state)))


@app.post("/reset")
def reset_demo():
    """Wipe this visitor's data and go back to the defaults."""
    _STORE[session.get("sid")] = default_state()
    flash("Demo data reset.", "success")
    return redirect(url_for("index"))


# --------------------------------------------------------------------------
# Routes: Notes -> Folder -> Class
# --------------------------------------------------------------------------
@app.route("/notes")
def notes_page():
    state = get_state()
    folders = [{"name": n, "class_count": len(f["classes"])}
               for n, f in state["folders"].items()]
    return render_template("notes.html", folders=folders)


@app.post("/folders/create")
def create_folder():
    state = get_state()
    name, error = clean_name(request.form.get("name"))
    if error:
        flash(error, "error")
    elif name in state["folders"]:
        flash(f'A folder named "{name}" already exists.', "error")
    else:
        state["folders"][name] = {"classes": {}}
        flash(f'Created folder "{name}".', "success")
    return redirect(url_for("notes_page"))


@app.route("/folder/<folder_name>")
def folder_page(folder_name):
    state = get_state()
    folder = state["folders"].get(folder_name)
    if folder is None:
        abort(404)
    session["last_folder"] = folder_name  # remembered as a fallback for class links
    return render_template("folder.html", folder_name=folder_name,
                           classes=list(folder["classes"]))


@app.post("/folder/<folder_name>/classes/create")
def create_class(folder_name):
    state = get_state()
    folder = state["folders"].get(folder_name)
    if folder is None:
        abort(404)
    name, error = clean_name(request.form.get("name"))
    if error:
        flash(error, "error")
    elif name in folder["classes"]:
        flash(f'"{name}" already exists in this folder.', "error")
    else:
        folder["classes"][name] = new_class()
        flash(f'Created class "{name}".', "success")
    return redirect(url_for("folder_page", folder_name=folder_name))


@app.route("/class/<class_name>")
def class_page(class_name):
    state = get_state()
    # Class names repeat across folders, so the folder travels as ?folder=...
    folder_name, cls = find_class(state, request.args.get("folder") or session.get("last_folder"),
                                  class_name)
    if cls is None:
        abort(404)
    unit = request.args.get("unit", "Unit1")
    if unit not in CLASS_MENU:
        unit = "Unit1"
    note = cls["units"].get(unit)  # None when the "Import" panel is open
    return render_template(
        "class.html",
        folder_name=folder_name, class_name=class_name, menu=CLASS_MENU, unit=unit,
        note=note, units=UNITS,
        files=state["canvas"]["files"] if state["canvas"] else [],
        history=state["chats"].get(f"{folder_name}|{class_name}", []),
    )


@app.post("/class/<class_name>/import")
def class_import(class_name):
    """Append an imported Canvas file reference / pasted text to a unit's note."""
    state = get_state()
    folder_name, cls = find_class(state, request.form.get("folder"), class_name)
    unit = request.form.get("unit")
    if cls is None or unit not in cls["units"]:
        abort(404)
    block = []
    if request.form.get("file"):
        block.append(f"[Imported file] {request.form['file']}")
    if request.form.get("pasted", "").strip():
        block.append(request.form["pasted"].strip())
    if block:
        note = cls["units"][unit]
        note["content"] = (note["content"] + "\n\n" + "\n".join(block)).strip()[:MAX_NOTE_CHARS]
        flash(f"Added to {unit}.", "success")
    else:
        flash("Pick a file or paste some text to import.", "error")
    return redirect(url_for("class_page", class_name=class_name, folder=folder_name, unit=unit))


# --------------------------------------------------------------------------
# JSON API used by the class page JavaScript
# --------------------------------------------------------------------------
@app.post("/api/note")
def api_note():
    """Autosave the note editor."""
    state = get_state()
    data = request.get_json(silent=True) or {}
    _, cls = find_class(state, data.get("folder"), data.get("class"))
    unit = data.get("unit")
    if cls is None or unit not in cls["units"]:
        return jsonify(ok=False, error="Unknown class or unit."), 404
    cls["units"][unit]["content"] = str(data.get("content", ""))[:MAX_NOTE_CHARS]
    return jsonify(ok=True)


@app.post("/api/chat")
def api_chat():
    """Chat bot endpoint: store the exchange and return the bot reply."""
    state = get_state()
    data = request.get_json(silent=True) or {}
    folder_name, cls = find_class(state, data.get("folder"), data.get("class"))
    message = str(data.get("message", "")).strip()[:1000]
    if cls is None or not message:
        return jsonify(ok=False, error="Missing class or message."), 400

    unit = data.get("unit")
    if unit in cls["units"]:
        note_text = cls["units"][unit]["content"]
    else:  # Import panel: give the bot every unit's notes
        note_text = "\n".join(u["content"] for u in cls["units"].values())

    reply = generate_reply(message, note_text, data.get("class"))
    history = state["chats"].setdefault(f"{folder_name}|{data.get('class')}", [])
    history += [{"role": "user", "text": message}, {"role": "bot", "text": reply}]
    del history[:-50]  # keep the last 50 messages
    return jsonify(ok=True, reply=reply)


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


if __name__ == "__main__":
    # host 0.0.0.0 lets GitHub Codespaces forward the port to your browser.
    app.run(host="0.0.0.0", port=5000, debug=True)