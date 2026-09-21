import { describe, it, expect } from "vitest";
import {
  dayLabel,
  dayPart,
  durationLabel,
  shiftSegments,
} from "./MissionCard";

// Dates construites en heure locale : les helpers lisent getHours().
const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m);

describe("dayPart", () => {
  it("découpe la journée en matin, midi, soir, nuit", () => {
    expect(dayPart(7)).toBe("matin");
    expect(dayPart(11)).toBe("midi");
    expect(dayPart(14)).toBe("midi");
    expect(dayPart(17)).toBe("soir");
    expect(dayPart(22)).toBe("nuit");
    expect(dayPart(2)).toBe("nuit");
  });

  it("place les bornes du côté du moment qui commence", () => {
    expect(dayPart(5)).toBe("matin");
    expect(dayPart(15)).toBe("soir");
    expect(dayPart(4)).toBe("nuit");
  });
});

describe("dayLabel", () => {
  const now = at(21, 16);
  it("nomme aujourd'hui et demain", () => {
    expect(dayLabel(at(21, 20), now)).toBe("Aujourd'hui");
    expect(dayLabel(at(22, 9), now)).toBe("Demain");
  });
  it("donne le jour et la date au-delà", () => {
    expect(dayLabel(at(24, 17), now)).toMatch(/24/);
  });
});

describe("shiftSegments", () => {
  it("place un service de jour sur une seule portion", () => {
    const [seg, ...rest] = shiftSegments(at(24, 12), at(24, 18));
    expect(rest).toHaveLength(0);
    expect(seg.left).toBeCloseTo(50);
    expect(seg.width).toBeCloseTo(25);
  });

  it("coupe en deux un service qui passe minuit", () => {
    const segs = shiftSegments(at(24, 22), at(25, 6));
    expect(segs).toHaveLength(2);
    expect(segs[0].left).toBeCloseTo((22 / 24) * 100);
    expect(segs[0].left + segs[0].width).toBeCloseTo(100);
    expect(segs[1].left).toBe(0);
    expect(segs[1].width).toBeCloseTo((6 / 24) * 100);
  });

  it("tient compte des minutes", () => {
    const [seg] = shiftSegments(at(24, 17, 30), at(24, 23));
    expect(seg.left).toBeCloseTo((17.5 / 24) * 100);
  });
});

describe("durationLabel", () => {
  it("arrondit au demi-heure et met la virgule française", () => {
    expect(durationLabel(at(24, 17), at(24, 23))).toBe("6 h");
    expect(durationLabel(at(24, 17), at(24, 23, 30))).toBe("6,5 h");
  });
  it("compte une nuit entière", () => {
    expect(durationLabel(at(24, 22), at(25, 6))).toBe("8 h");
  });
});
