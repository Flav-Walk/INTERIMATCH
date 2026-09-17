import type { Skill } from "../../services/session";
import type { SkillLevel } from "../../services/missions";

/**
 * Trois réponses possibles par compétence, dont une seule peut être retenue.
 * L'exclusivité entre « obligatoire » et « souhaitée » ne vient pas d'un
 * contrôle : elle vient de la forme du choix, qui ne permet pas d'exprimer les
 * deux. Le serveur la revérifie de son côté.
 */
const levels: { value: "" | SkillLevel; label: string; hint: string }[] = [
  { value: "", label: "Non", hint: "non demandée" },
  { value: "required", label: "Obligatoire", hint: "obligatoire" },
  { value: "desired", label: "Souhaitée", hint: "souhaitée" },
];

export function SkillPicker({
  skills,
  value,
  onChange,
}: {
  skills: Skill[];
  value: Record<string, SkillLevel>;
  onChange: (next: Record<string, SkillLevel>) => void;
}) {
  const counts = Object.values(value).reduce(
    (acc, level) => ({ ...acc, [level]: (acc[level] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  function select(skillId: string, level: "" | SkillLevel) {
    const next = { ...value };
    if (level === "") delete next[skillId];
    else next[skillId] = level;
    onChange(next);
  }

  if (!skills.length)
    return <p className="quiet">Chargement des compétences…</p>;

  return (
    <div className="skill-matrix">
      {skills.map((skill) => (
        <div
          className="skill-row"
          role="radiogroup"
          aria-labelledby={"skill-name-" + skill.id}
          key={skill.id}
        >
          <span className="skill-name" id={"skill-name-" + skill.id}>
            {skill.name}
          </span>
          <span className="skill-levels">
            {levels.map((level) => (
              <label
                className="skill-choice"
                key={level.value || "none"}
                data-level={level.value || "none"}
              >
                <input
                  type="radio"
                  name={"skill-" + skill.id}
                  checked={(value[skill.id] ?? "") === level.value}
                  onChange={() => select(skill.id, level.value)}
                  // Le libellé visible est court pour tenir sur une ligne ;
                  // le nom accessible, lui, reste complet et situé.
                  aria-label={`${skill.name} : ${level.hint}`}
                />
                {level.label}
              </label>
            ))}
          </span>
        </div>
      ))}
      <p className="quiet" role="status">
        {counts.required ?? 0} obligatoire
        {(counts.required ?? 0) > 1 ? "s" : ""} · {counts.desired ?? 0}{" "}
        souhaitée{(counts.desired ?? 0) > 1 ? "s" : ""}
      </p>
    </div>
  );
}
