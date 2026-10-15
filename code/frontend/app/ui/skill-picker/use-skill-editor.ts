"use client";

import { useRef, useState } from "react";

import {
  addUserSkillAction,
  cancelReportAction,
  removeUserSkillAction,
  reportSkillAction,
  setUserSkillLevelAction,
} from "@/app/skills/actions";
import type { OpenReport, ReportResult } from "@/lib/skill-report-input";
import { DEFAULT_SKILL_LEVEL, type SkillRatingLevel, type UserSkillEntry } from "@/lib/skills";

export type SkillEditorState = { skills: UserSkillEntry[]; reports: OpenReport[] };

const GENERIC_ERROR = "Something went wrong. Please try again.";

// Optimistic editing of the user's skills: the list changes immediately,
// the server action runs, and a failure puts the old value back with a
// short message. State lives in a ref as well as React state so several
// in-flight changes always build on the latest list, not a stale closure.
//
// `busy` holds the slugs/report ids with a request in flight; their rows
// disable remove/cancel so an add can't race a remove of the same skill.
export function useSkillEditor(initial: SkillEditorState, onChange?: (state: SkillEditorState) => void) {
  const [state, setState] = useState(initial);
  const stateRef = useRef(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  function commit(update: (prev: SkillEditorState) => SkillEditorState) {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
    onChange?.(next);
  }

  function markBusy(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function guarded<T>(id: string, run: () => Promise<T>, fallback: T): Promise<T> {
    markBusy(id, true);
    try {
      return await run();
    } catch (err) {
      console.error(err);
      return fallback;
    } finally {
      markBusy(id, false);
    }
  }

  async function add(skill: { slug: string; name: string }, level: SkillRatingLevel = DEFAULT_SKILL_LEVEL) {
    if (stateRef.current.skills.some((s) => s.slug === skill.slug)) return;
    setError(null);
    commit((s) => ({ ...s, skills: [...s.skills, { slug: skill.slug, name: skill.name, level }] }));
    const res = await guarded(skill.slug, () => addUserSkillAction(skill.slug, level), {
      ok: false as const,
      error: GENERIC_ERROR,
    });
    if (res.ok) {
      commit((s) => ({ ...s, skills: s.skills.map((x) => (x.slug === skill.slug ? res.skill : x)) }));
    } else {
      commit((s) => ({ ...s, skills: s.skills.filter((x) => x.slug !== skill.slug) }));
      setError(res.error);
    }
  }

  async function addMany(skills: { slug: string; name: string }[]) {
    await Promise.all(skills.map((s) => add(s)));
  }

  async function setLevel(slug: string, level: SkillRatingLevel) {
    const previous = stateRef.current.skills.find((s) => s.slug === slug);
    if (!previous || previous.level === level) return;
    setError(null);
    commit((s) => ({ ...s, skills: s.skills.map((x) => (x.slug === slug ? { ...x, level } : x)) }));
    const res = await guarded(slug, () => setUserSkillLevelAction(slug, level), { ok: false as const, error: GENERIC_ERROR });
    if (!res.ok) {
      commit((s) => ({ ...s, skills: s.skills.map((x) => (x.slug === slug ? previous : x)) }));
      setError(res.error);
    }
  }

  async function remove(slug: string) {
    const index = stateRef.current.skills.findIndex((s) => s.slug === slug);
    if (index === -1) return;
    const previous = stateRef.current.skills[index];
    setError(null);
    commit((s) => ({ ...s, skills: s.skills.filter((x) => x.slug !== slug) }));
    const res = await guarded(slug, () => removeUserSkillAction(slug), { ok: false as const, error: GENERIC_ERROR });
    if (!res.ok) {
      commit((s) => {
        const skills = [...s.skills];
        skills.splice(Math.min(index, skills.length), 0, previous);
        return { ...s, skills };
      });
      setError(res.error);
    }
  }

  async function report(input: { rawName: string; level: SkillRatingLevel; note: string }): Promise<ReportResult> {
    setError(null);
    let res: ReportResult;
    try {
      res = await reportSkillAction(input);
    } catch (err) {
      console.error(err);
      res = { status: "error", error: GENERIC_ERROR };
    }
    if (res.status === "reported") {
      const created = res.report;
      commit((s) => ({ ...s, reports: [...s.reports, created] }));
    } else if (res.status === "exists") {
      const skill = res.skill;
      commit((s) => (s.skills.some((x) => x.slug === skill.slug) ? s : { ...s, skills: [...s.skills, skill] }));
    }
    return res;
  }

  async function cancelReport(id: string) {
    const index = stateRef.current.reports.findIndex((r) => r.id === id);
    if (index === -1) return;
    const previous = stateRef.current.reports[index];
    setError(null);
    commit((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
    const res = await guarded(id, () => cancelReportAction(id), { ok: false });
    if (!res.ok) {
      commit((s) => {
        const reports = [...s.reports];
        reports.splice(Math.min(index, reports.length), 0, previous);
        return { ...s, reports };
      });
      setError(GENERIC_ERROR);
    }
  }

  return {
    skills: state.skills,
    reports: state.reports,
    error,
    dismissError: () => setError(null),
    busy,
    add,
    addMany,
    setLevel,
    remove,
    report,
    cancelReport,
  };
}
