# Putaway round — removing the "magic" from the demonstration

Version `1.6-putaway-round`. This document explains what changed after the
second review of the recorded demonstration, why the old flow looked physically
impossible, and how the new flow is machine-checked so it cannot regress.

---

## The problem in the recording

In `1.5` a package had **two** legs:

```
leg 1  PUTAWAY   inbound table  ->  rack slot
leg 2  PICK      rack slot      ->  delivery table
```

When a unit finished leg 1 the slot it had just filled immediately became the
pickup of leg 2, and the auction could hand that second leg back to the *same*
unit standing on the *same* cell. On screen the result read as sleight of hand:

* a carton was placed into a rack,
* a new carton appeared in the unit's arms at the same spot, out of thin air,
* that carton went into a rack again,
* a third carton appeared and was carried off to a table.

Nothing was actually duplicated in the data model, but the *presentation* had no
way to show where the second carton came from, so it looked like magic. Racks
also shipped pre-filled with decorative cartons on every deck, so a judge could
not tell stock a robot placed from scenery.

---

## The new flow

One leg. One carton. One destination.

```
RECEIVE  twelve tables (T01..T06 west, T07..T12 east) each hold exactly ONE carton
PUTAWAY  a unit wins a carton at auction, drives to the table, lifts it
STORE    it carries the carton to its reserved rack slot and slides it in
DOCK     when all twelve are stored, every unit books a pad over the mesh,
         drives to it, plugs in and parks for the shift
```

There is **no retrieval leg**. Nothing is ever taken back out of a rack during
the round, so the event that produced the illusion cannot happen.

### Where a carton can be

At every tick a carton is in exactly **one** of four places, and the frontend
draws it from that single source of truth:

| Place | Owner in the state payload | Drawn by |
| :-- | :-- | :-- |
| On its table | `warehouse.tables[i].state == "loaded"` | `Station` in `Warehouse.jsx` |
| Mid-transfer | `robot.handling.task_id` | `Robot.jsx` transfer pose |
| In the arms | `robot.has_cargo` | `Robot.jsx` carry pose |
| In its slot | `warehouse.racks[i].state == "stored"` | rack slot in `Warehouse.jsx` |

`mapCargoLifecycle()` excludes any carton that is mid-transfer from both the
table list and the slot list, because during the lift/place dwell the robot owns
it. Nothing is inferred from the task queue any more — that inference is what
allowed a carton to be drawn twice.

### Exact hand-off moments

* The table goes `loaded -> empty` on the **first frame of the lift dwell**
  (`task_manager.note_pickup()` is called at `progress == 0`), so the carton is
  never visible on the table and in the arms at the same time.
* The slot goes `reserved -> stored` **only when the place dwell completes**, so
  a carton never appears on a shelf before the arms have reached it.
* A slot is reserved for its carton from tick 0, which is why the queue can show
  `T04 -> B2-01` before the unit has left.

### Racks start bare

The deck the fleet stores on is empty at the start of the round. Only the top
deck (out of the robots' reach) keeps a little legacy stock for depth, and the
low-rack camera view removes even that. Every carton a judge sees on the
storage deck was put there by a robot on screen.

### End of round

`Robot.park_for_charging()` reuses the same pad negotiation as a low-battery
detour: closest unit wins a contested pad, ties break on unit id, so two units
never claim one pad. It refuses to run while a unit is holding a carton, so
finishing the round can never strand cargo mid-air. After topping up, the unit
**keeps** its pad and sets `parked`, which stops it bidding and stops it
wandering — it is physically standing there, cable connected.

A mid-round charge run still happens: `DEMO_BATTERY_LEVELS = [58.0, 100.0, 76.0]`
and `BATTERY_LOW_THRESHOLD = 50.0` mean a unit abandons its place in the queue,
charges and returns during the round. "Force low battery" in the controls
triggers it on demand.

---

## Configuration

| Constant | Value | Note |
| :-- | :-- | :-- |
| `STORAGE_FLOW_ENABLED` | `True` | demo runs the rack round; benchmark stays direct |
| `STAGED_TABLES` | `12` | one carton per table, 6 west + 6 east |
| `END_OF_ROUND_CHARGE` | `True` | fleet docks and parks when the manifest is empty |
| `BATTERY_LOW_THRESHOLD` | `50.0` | mid-round detour trigger |
| `BATTERY_CHARGE_PER_TICK` | `2.0` | ~25 ticks from 50% to full |
| `DEMO_BATTERY_LEVELS` | `[58.0, 100.0, 76.0]` | opening state of charge |

The benchmark path is untouched: `baseline.py` and `test_simulation.py` still
run the direct pickup/dropoff manifest with `TASKS_PER_EPISODE = 6`.

---

## Invariants checked on every tick

`python3 smoke_demo.py` replays the whole round headlessly and fails loudly if
any of these break:

1. every staged carton is in exactly one place — never zero, never two,
2. a table may only go `loaded -> empty`, once, and is never refilled,
3. a stored carton stays stored,
4. the round ends with all twelve slots filled, every unit parked, each on a
   different pad, zero collisions and zero pad double-bookings.

Last recorded run: last carton stored at tick 193, fleet parked at tick 240,
12/12 stored, 12/12 tables emptied, charge cycles 2 / 1 / 2, collisions 0, pad
double-books 0.

### Verification commands

```bash
cd backend
python3 -m py_compile *.py
python3 -m unittest test_presentation_contract -v   # 7 tests
python3 smoke_demo.py                               # invariant replay

cd ../frontend
node --test src/utils/*.test.js                     # 19 tests
```
