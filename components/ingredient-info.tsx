"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import Image from "next/image";
import { AlertTriangle, Flame, Info, Refrigerator, ShieldCheck, Snowflake, Package, PackageOpen, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ingredientReferenceFor,
  ingredientReferenceSources,
  parseAllergens,
  ukFoodSafetyRules,
  type ReferenceCategory,
  type UkAllergen,
} from "@/lib/ingredient-reference";
import styles from "./ingredient-info.module.css";

const allergenLabel = (allergen: UkAllergen) => allergen.charAt(0).toUpperCase() + allergen.slice(1);

type Props = {
  /** The ingredient's name as it appears in the catalogue. */
  name: string;
  category?: ReferenceCategory;
  /** The allergen text recorded on the catalogue ingredient, compared against the guide. */
  allergens?: string;
  /** What the trigger shows; defaults to the name. */
  children?: ReactNode;
  className?: string;
};

/** An ingredient name that shows UK storage, shelf-life, allergen and cooking guidance on hover (or tap on touch screens). */
export function IngredientInfo({ name, category, allergens, children, className }: Props) {
  const [open, setOpenState] = useState(false);
  const [side, setSide] = useState<"right" | "bottom">("right");
  // Narrow screens show the card below the name so it has the full width.
  const setOpen = (next: boolean) => {
    if (next) setSide(window.innerWidth < 768 ? "bottom" : "right");
    setOpenState(next);
  };
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = (next: boolean, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  };
  const onEnter = (event: PointerEvent) => {
    if (event.pointerType === "mouse") schedule(true, 200);
  };
  const onLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && !pinned.current) schedule(false, 180);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        clearTimeout(timer.current);
        if (!next) pinned.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${styles.trigger} ${className || ""}`}
          aria-label={`${name}: storage, allergen and cooking guide`}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          onClick={(event) => {
            // A click pins the card open, or closes it if it is already pinned.
            event.preventDefault();
            clearTimeout(timer.current);
            if (open && pinned.current) {
              pinned.current = false;
              setOpen(false);
            } else {
              pinned.current = true;
              setOpen(true);
            }
          }}
        >
          <span>{children ?? name}</span>
          <Info aria-hidden="true" size={12} className={styles.triggerIcon} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={styles.card}
        side={side}
        align="start"
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        {open ? <IngredientInfoCard name={name} category={category} allergens={allergens} /> : null}
      </PopoverContent>
    </Popover>
  );
}

export function IngredientInfoCard({ name, category, allergens }: Omit<Props, "children" | "className">) {
  const { reference, generic } = useMemo(() => ingredientReferenceFor(name, category), [name, category]);
  const recorded = useMemo(() => (allergens == null ? null : parseAllergens(allergens)), [allergens]);
  const missing = recorded ? reference.allergens.filter((allergen) => !recorded.includes(allergen)) : [];
  // Show what the guide says plus anything the business has recorded on the ingredient.
  const contains = [...new Set([...reference.allergens, ...(recorded || [])])];
  const checkLabel = (reference.checkLabel || []).filter((allergen) => !contains.includes(allergen));
  const shelfLife = [
    { icon: Refrigerator, label: "Fridge", value: reference.shelfLife.fridge },
    { icon: Snowflake, label: "Freezer", value: reference.shelfLife.freezer },
    { icon: Package, label: "Cupboard", value: reference.shelfLife.ambient },
    { icon: PackageOpen, label: "Once opened", value: reference.shelfLife.opened },
  ].filter((row) => row.value);

  return (
    <article className={styles.body} aria-label={`${name} guide`}>
      <header className={styles.header}>
        <div className={styles.image} data-category={reference.category}>
          {reference.image ? (
            <Image src={reference.image} alt={reference.name} fill sizes="72px" />
          ) : (
            <span role="img" aria-label={`${reference.name} illustration`}>
              {reference.emoji}
            </span>
          )}
        </div>
        <div>
          <h4 className={styles.title}>{name}</h4>
          <p className={styles.subtitle}>
            {generic ? `General ${reference.category} guidance` : reference.name !== name ? `Guide: ${reference.name}` : reference.category}
          </p>
          {reference.highRisk ? (
            <span className={styles.riskChip}>
              <AlertTriangle aria-hidden="true" size={11} /> High-risk food
            </span>
          ) : null}
        </div>
      </header>

      <section className={styles.section}>
        <h5>Allergens (UK 14)</h5>
        <div className={styles.chips}>
          {contains.map((allergen) => (
            <span key={allergen} className={styles.contains}>
              {allergenLabel(allergen)}
            </span>
          ))}
          {checkLabel.map((allergen) => (
            <span key={allergen} className={styles.mayContain} title="Depends on the brand or recipe">
              {allergenLabel(allergen)}?
            </span>
          ))}
          {!contains.length && !checkLabel.length ? (
            <span className={styles.none}>
              <ShieldCheck aria-hidden="true" size={11} /> None of the 14
            </span>
          ) : null}
        </div>
        {checkLabel.length ? <p className={styles.hint}>Items marked ? depend on the brand: check the label.</p> : null}
        {reference.allergenNote ? <p className={styles.hint}>{reference.allergenNote}</p> : null}
        {missing.length ? (
          <p className={styles.warning}>
            <AlertTriangle aria-hidden="true" size={12} /> Your ingredient record doesn&rsquo;t list {missing.map(allergenLabel).join(", ")}.
          </p>
        ) : null}
      </section>

      {shelfLife.length ? (
        <section className={styles.section}>
          <h5>Typical shelf life</h5>
          <dl className={styles.shelf}>
            {shelfLife.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <dt>
                  <Icon aria-hidden="true" size={12} /> {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className={styles.section}>
        <h5>Storage</h5>
        <p>{reference.storage}</p>
      </section>

      {reference.cooking ? (
        <section className={styles.section}>
          <h5>
            <Flame aria-hidden="true" size={12} /> Cooking
          </h5>
          <p>{reference.cooking}</p>
        </section>
      ) : null}

      {reference.handling.length ? (
        <section className={styles.section}>
          <h5>Handling</h5>
          <ul>
            {reference.handling.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {reference.catering?.length ? (
        <section className={styles.section}>
          <h5>Catering notes</h5>
          <ul>
            {reference.catering.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <dl className={styles.rules}>
          {ukFoodSafetyRules.slice(0, 4).map((rule) => (
            <div key={rule.label}>
              <dt>{rule.label}</dt>
              <dd>{rule.value}</dd>
            </div>
          ))}
        </dl>
        <p>
          {generic ? "No specific guide for this item yet. " : ""}Guide only: the pack&rsquo;s use-by date and your food safety plan take priority.{" "}
          <a href={ingredientReferenceSources[0].url} target="_blank" rel="noreferrer">
            FSA guidance <ExternalLink aria-hidden="true" size={10} />
          </a>
        </p>
      </footer>
    </article>
  );
}
