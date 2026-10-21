"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Download,
  ExternalLink,
  ImagePlus,
  Monitor,
  Plus,
  RefreshCw,
  Smartphone,
  FileText,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Field, Pick } from "@/components/form-controls";
import { MarkdownField } from "@/components/menu/markdown-field";
import { today } from "@/lib/domain";
import {
  allergenHints,
  currentSeason,
  hasUnpublishedChanges,
  publicMenu,
  seasonRecipes,
  staleItems,
  type Menu,
  type MenuItem,
  type MenuSection,
} from "@/lib/menu";
import {
  menuAccents,
  menuBackgrounds,
  menuImageLibrary,
  menuLayouts,
  menuSeasons,
  menuTags,
  type Season,
} from "@/lib/menu-theme";
import { useOps } from "./ops-context";
import { Tag } from "./admin-client";

type View = "desktop" | "mobile" | "a4";
const viewWidths: Record<View, number> = { desktop: 1280, mobile: 390, a4: 860 };
const newId = () => crypto.randomUUID();
const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
const penceToPounds = (pence: number | null) =>
  pence == null ? "" : (pence / 100).toFixed(2).replace(/\.00$/, "");

export default function MenuStudio() {
  const { s, mode, run, busy } = useOps();
  const menus = useMemo(() => s.menus || [], [s.menus]);
  const [year, setYear] = useState(today().slice(0, 4));
  const [season, setSeason] = useState<Season>(currentSeason());
  const [local, setLocal] = useState<Menu | null>(null);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"content" | "dishes" | "design">("content");
  const [view, setView] = useState<View>("desktop");

  const years = useMemo(
    () =>
      [
        ...new Set([
          Number(today().slice(0, 4)),
          Number(today().slice(0, 4)) + 1,
          ...s.recipes.flatMap((r) => (r.collections || []).map((c) => c.year)),
          ...menus.map((m) => m.year),
        ]),
      ]
        .sort((a, b) => b - a)
        .map(String),
    [s.recipes, menus],
  );
  const saved = menus.find((m) => m.year === Number(year) && m.season === season);
  const menu = local && saved && local.id === saved.id ? local : saved;
  const recipes = seasonRecipes(s, Number(year), season);

  // Every edit works on a copy of the current menu; autosave persists it.
  const update = (change: (draft: Menu) => void) => {
    if (!saved) return;
    setLocal((current) => {
      const next = structuredClone(current && current.id === saved.id ? current : saved);
      change(next);
      return next;
    });
  };

  const save = useCallback(async () => {
    if (!local) return;
    const snapshot = local;
    setStatus("saving");
    try {
      await run("menu-save", snapshot);
      setLocal((current) => (current === snapshot ? null : current));
      setStatus("saved");
      setError("");
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }, [local, run]);

  useEffect(() => {
    if (!local || busy) return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [local, busy, save]);

  async function action(type: string, payload: Record<string, unknown>) {
    setError("");
    try {
      if (local) await save();
      await run(type, payload);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Preview frame: the real public page components rendered at true width.
  const frame = useRef<HTMLIFrameElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [holderWidth, setHolderWidth] = useState(800);
  const preview = useMemo(() => (menu ? publicMenu(menu) : null), [menu]);
  const postPreview = useCallback(() => {
    if (!preview) return;
    frame.current?.contentWindow?.postMessage(
      { type: "em2-menu-preview", menu: preview, view },
      window.location.origin,
    );
  }, [preview, view]);
  useEffect(() => {
    postPreview();
  }, [postPreview]);
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === "em2-menu-preview-ready"
      )
        postPreview();
    };
    window.addEventListener("message", ready);
    return () => window.removeEventListener("message", ready);
  }, [postPreview]);
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setHolderWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [menu?.id]);
  const width = viewWidths[view];
  const scale = Math.min(1, holderWidth / width);
  // The preview fills the visible height; the frame scrolls like the real page.
  const frameHeight = "calc(100vh - 150px)";

  const printPdf = () => {
    setView("a4");
    // Give the frame a moment to render the A4 sheet before printing.
    setTimeout(
      () =>
        frame.current?.contentWindow?.postMessage(
          { type: "em2-menu-print" },
          window.location.origin,
        ),
      400,
    );
  };

  const unsaved = !!local;
  const changedSincePublish = !!menu && (hasUnpublishedChanges(menu) || (unsaved && !!menu.published));

  return (
    <div className="menu-studio">
      <div className="menu-studio__bar">
        <div className="menu-studio__pickers">
          <Pick label="Year" value={year} onChange={setYear} options={years} />
          <Pick
            label="Season"
            value={season}
            onChange={(value) => setSeason(value as Season)}
            options={[...menuSeasons]}
          />
        </div>
        {menu && (
          <div className="menu-studio__status">
            {menu.published ? (
              <Tag tone={changedSincePublish ? "amber" : "green"}>
                {changedSincePublish ? "Published · unpublished changes" : "Published"}
              </Tag>
            ) : (
              <Tag>Draft</Tag>
            )}
            <small role="status">
              {status === "saving" || (unsaved && status !== "error")
                ? "Saving…"
                : status === "error"
                  ? "Not saved"
                  : "All changes saved"}
            </small>
          </div>
        )}
        {menu && (
          <div className="menu-studio__actions">
            <Button variant="outline" size="sm" onClick={printPdf}>
              <Download size={15} /> Download PDF
            </Button>
            {menu.published && mode === "live" && (
              <Button variant="outline" size="sm" asChild>
                <a href="/menu" target="_blank" rel="noreferrer">
                  <ExternalLink size={15} /> View live page
                </a>
              </Button>
            )}
            {menu.published && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (confirm("Remove this menu from the website?"))
                    void action("menu-unpublish", { id: menu.id });
                }}
              >
                Unpublish
              </Button>
            )}
            <Button
              size="sm"
              disabled={busy || (!!menu.published && !changedSincePublish)}
              onClick={() => void action("menu-publish", { id: menu.id })}
            >
              {menu.published ? "Publish changes" : "Publish to website"}
            </Button>
          </div>
        )}
      </div>
      {mode === "sample" && (
        <p className="panel-note">
          Sample workspace: publishing here lets you try the workflow, but only
          the live workspace menu appears on the website.
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {!menu ? (
        <section className="menu-studio__empty">
          <BookOpen size={34} />
          <h2>
            Create the {season} {year} menu
          </h2>
          <p>
            {recipes.length
              ? `${recipes.length} active recipe${recipes.length === 1 ? "" : "s"} in the ${season} ${year} collection will be arranged into starters, mains and desserts. You can rename, reorder and style everything afterwards.`
              : `There are no active recipes in the ${season} ${year} collection yet. Add recipes to this season in Recipes & costing first.`}
          </p>
          <Button
            disabled={busy || !recipes.length}
            onClick={() =>
              void action("menu-generate", { year: Number(year), season })
            }
          >
            <Plus size={16} /> Generate menu from recipes
          </Button>
        </section>
      ) : (
        <div className="menu-studio__grid">
          <div className="menu-studio__editor">
            <div className="menu-studio__tabs" role="tablist" aria-label="Menu editor">
              {(
                [
                  ["content", "Content"],
                  ["dishes", "Sections & dishes"],
                  ["design", "Design"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={tab === value ? "active" : ""}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "content" && <ContentTab menu={menu} update={update} />}
            {tab === "dishes" && (
              <DishesTab menu={menu} update={update} onSync={() => void action("menu-sync", { id: menu.id })} />
            )}
            {tab === "design" && <DesignTab menu={menu} update={update} />}
            <div className="menu-studio__danger">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Delete the ${menu.season} ${menu.year} menu? This cannot be undone.`)) {
                    setLocal(null);
                    void action("menu-delete", { id: menu.id });
                  }
                }}
              >
                <Trash2 size={14} /> Delete this menu
              </Button>
            </div>
          </div>
          <div className="menu-studio__preview">
            <div className="menu-studio__preview-bar">
              <span>Live preview · exactly as the website shows it</span>
              <div role="group" aria-label="Preview size">
                {(
                  [
                    ["desktop", Monitor, "Desktop"],
                    ["mobile", Smartphone, "Mobile"],
                    ["a4", FileText, "A4 PDF"],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={view === value}
                    onClick={() => setView(value)}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="menu-studio__frame-holder" ref={holder}>
              <div
                className="menu-studio__frame-box"
                style={{ width: width * scale, height: frameHeight }}
              >
                <iframe
                  ref={frame}
                  title="Menu preview"
                  src="/menu/preview"
                  onLoad={postPreview}
                  style={{
                    width,
                    height: `calc((100vh - 150px) / ${scale})`,
                    transform: `scale(${scale})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {menus.length > 0 && (
        <section className="menu-studio__list" aria-label="All menus">
          <h2>All menus</h2>
          <div>
            {[...menus]
              .sort((a, b) => b.year - a.year || menuSeasons.indexOf(a.season) - menuSeasons.indexOf(b.season))
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={m.id === menu?.id ? "active" : ""}
                  onClick={() => {
                    setYear(String(m.year));
                    setSeason(m.season);
                  }}
                >
                  <strong>{m.title}</strong>
                  <small>
                    {m.season} {m.year} · {m.published ? "Published" : "Draft"}
                  </small>
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

type TabProps = { menu: Menu; update: (change: (draft: Menu) => void) => void };

function EditorGroup({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="menu-editor-group">
      <legend>{title}</legend>
      {hint && <p className="menu-editor-hint">{hint}</p>}
      {children}
    </fieldset>
  );
}

function ContentTab({ menu, update }: TabProps) {
  return (
    <>
      <EditorGroup title="Heading">
        <Field
          label="Menu title"
          required
          value={menu.title}
          onChange={(title) => update((d) => { d.title = title; })}
        />
        <MarkdownField
          label="Introduction"
          rows={4}
          value={menu.intro}
          placeholder="A few words about this season's food…"
          onChange={(intro) => update((d) => { d.intro = intro; })}
        />
      </EditorGroup>
      <EditorGroup title="Prices" hint="Prices are your selling prices, entered per dish. Internal costs are never shown.">
        <label className="menu-switch">
          <Switch
            checked={menu.showPrices}
            onCheckedChange={(showPrices) => update((d) => { d.showPrices = showPrices; })}
          />
          Show prices on the website and PDF
        </label>
      </EditorGroup>
      <EditorGroup title="Closing note">
        <MarkdownField
          label="Footer note"
          rows={3}
          value={menu.footerNote}
          onChange={(footerNote) => update((d) => { d.footerNote = footerNote; })}
        />
        <p className="menu-editor-hint">
          An allergy notice and a key for dietary tags are always added below this note.
        </p>
      </EditorGroup>
    </>
  );
}

function DishesTab({ menu, update, onSync }: TabProps & { onSync: () => void }) {
  const { s, busy } = useOps();
  const recipes = seasonRecipes(s, menu.year, menu.season);
  const used = new Set(menu.sections.flatMap((x) => x.items.map((i) => i.recipeId)));
  const unused = recipes.filter((r) => !used.has(r.id));
  const stale = staleItems(s, menu);
  const recipeImages = s.recipes.map((r) => r.imageUrl || "").filter(Boolean);
  const editSection = (index: number, change: (section: MenuSection) => void) =>
    update((d) => change(d.sections[index]));
  return (
    <>
      <div className="menu-editor-sync">
        <p>
          {unused.length
            ? `${unused.length} ${menu.season} ${menu.year} recipe${unused.length === 1 ? " is" : "s are"} not on this menu yet.`
            : `All ${menu.season} ${menu.year} recipes are on this menu.`}
        </p>
        <Button variant="outline" size="sm" disabled={busy || !unused.length} onClick={onSync}>
          <RefreshCw size={14} /> Sync from recipes
        </Button>
      </div>
      {stale.length > 0 && (
        <p className="menu-editor-warning" role="status">
          {stale.map((item) => item.name).join(", ")}{" "}
          {stale.length === 1 ? "is" : "are"} no longer an active recipe in this season. Remove or keep as a custom dish.
        </p>
      )}
      {menu.sections.map((section, sectionIndex) => (
        <section className="menu-editor-section" key={section.id}>
          <div className="menu-editor-section__head">
            <Field
              label={`Section ${sectionIndex + 1} title`}
              value={section.title}
              onChange={(title) => editSection(sectionIndex, (x) => { x.title = title; })}
            />
            <div className="menu-icon-actions">
              <IconButton label="Move section up" disabled={sectionIndex === 0} onClick={() => update((d) => { d.sections = move(d.sections, sectionIndex, sectionIndex - 1); })}>
                <ArrowUp size={14} />
              </IconButton>
              <IconButton label="Move section down" disabled={sectionIndex === menu.sections.length - 1} onClick={() => update((d) => { d.sections = move(d.sections, sectionIndex, sectionIndex + 1); })}>
                <ArrowDown size={14} />
              </IconButton>
              <IconButton
                label="Delete section"
                onClick={() => {
                  if (!section.items.length || confirm(`Delete “${section.title}” and its ${section.items.length} dish(es)?`))
                    update((d) => { d.sections.splice(sectionIndex, 1); });
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          </div>
          <details className="menu-editor-more">
            <summary>Section note & image</summary>
            <MarkdownField
              label="Section note"
              rows={2}
              value={section.description}
              onChange={(description) => editSection(sectionIndex, (x) => { x.description = description; })}
            />
            <ImagePicker
              label="Section image"
              value={section.imageUrl}
              suggestions={recipeImages}
              onChange={(imageUrl) => editSection(sectionIndex, (x) => { x.imageUrl = imageUrl; })}
            />
          </details>
          <ol className="menu-editor-items">
            {section.items.map((item, itemIndex) => (
              <DishEditor
                key={item.id}
                item={item}
                sections={menu.sections}
                sectionIndex={sectionIndex}
                first={itemIndex === 0}
                last={itemIndex === section.items.length - 1}
                recipeImages={recipeImages}
                hints={allergenHints(s, item.recipeId)}
                change={(change) => editSection(sectionIndex, (x) => change(x.items[itemIndex]))}
                shift={(offset) => editSection(sectionIndex, (x) => { x.items = move(x.items, itemIndex, itemIndex + offset); })}
                moveTo={(target) =>
                  update((d) => {
                    const [moved] = d.sections[sectionIndex].items.splice(itemIndex, 1);
                    d.sections[target].items.push(moved);
                  })
                }
                remove={() => editSection(sectionIndex, (x) => { x.items.splice(itemIndex, 1); })}
              />
            ))}
          </ol>
          <div className="menu-editor-add">
            {unused.length > 0 && (
              <Pick
                label="Add a recipe"
                value=""
                options={unused.map((r) => ({ value: r.id, label: `${r.name} · ${r.variant}` }))}
                onChange={(recipeId) => {
                  const recipe = s.recipes.find((r) => r.id === recipeId);
                  if (!recipe) return;
                  editSection(sectionIndex, (x) => {
                    x.items.push({
                      id: newId(),
                      recipeId: recipe.id,
                      name: recipe.name,
                      description: recipe.variant,
                      imageUrl: recipe.imageUrl || "",
                      showImage: !!recipe.imageUrl,
                      price: null,
                      tags: [],
                    });
                  });
                }}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                editSection(sectionIndex, (x) => {
                  x.items.push({ id: newId(), name: "New dish", description: "", imageUrl: "", showImage: false, price: null, tags: [] });
                })
              }
            >
              <Plus size={14} /> Custom dish
            </Button>
          </div>
        </section>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          update((d) => {
            d.sections.push({ id: newId(), title: "New section", description: "", imageUrl: "", items: [] });
          })
        }
      >
        <Plus size={15} /> Add section
      </Button>
    </>
  );
}

function DishEditor({
  item,
  sections,
  sectionIndex,
  first,
  last,
  recipeImages,
  hints,
  change,
  shift,
  moveTo,
  remove,
}: {
  item: MenuItem;
  sections: MenuSection[];
  sectionIndex: number;
  first: boolean;
  last: boolean;
  recipeImages: string[];
  hints: string[];
  change: (change: (item: MenuItem) => void) => void;
  shift: (offset: number) => void;
  moveTo: (section: number) => void;
  remove: () => void;
}) {
  const [price, setPrice] = useState(penceToPounds(item.price));
  return (
    <li className="menu-editor-dish">
      <details>
        <summary>
          <span className="menu-editor-dish__name">
            {item.showImage && item.imageUrl ? (
              <Image src={item.imageUrl} alt="" width={36} height={36} unoptimized />
            ) : (
              <span className="menu-editor-dish__dot" />
            )}
            <strong>{item.name}</strong>
            {item.tags.length > 0 && <small>{item.tags.join(" · ")}</small>}
          </span>
          <span className="menu-editor-dish__price">
            {item.price != null ? `£${penceToPounds(item.price)}` : ""}
          </span>
          <span className="menu-icon-actions" onClick={(event) => event.preventDefault()}>
            <IconButton label={`Move ${item.name} up`} disabled={first} onClick={() => shift(-1)}>
              <ArrowUp size={13} />
            </IconButton>
            <IconButton label={`Move ${item.name} down`} disabled={last} onClick={() => shift(1)}>
              <ArrowDown size={13} />
            </IconButton>
          </span>
        </summary>
        <div className="menu-editor-dish__body">
          <Field label="Dish name" required value={item.name} onChange={(name) => change((x) => { x.name = name; })} />
          <MarkdownField
            label="Description"
            rows={2}
            value={item.description}
            onChange={(description) => change((x) => { x.description = description; })}
          />
          <div className="menu-editor-row">
            <Field
              label="Price (£)"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(value) => {
                setPrice(value);
                const pounds = Number(value);
                change((x) => {
                  x.price = value === "" || !Number.isFinite(pounds) || pounds < 0 ? null : Math.round(pounds * 100);
                });
              }}
            />
            {sections.length > 1 && (
              <Pick
                label="Move to section"
                value=""
                options={sections
                  .map((section, index) => ({ value: String(index), label: section.title }))
                  .filter((option) => Number(option.value) !== sectionIndex)}
                onChange={(value) => moveTo(Number(value))}
              />
            )}
          </div>
          <div className="menu-editor-tags" role="group" aria-label="Dietary tags">
            <span>Dietary tags</span>
            {menuTags.map((tag) => {
              const on = item.tags.includes(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    change((x) => {
                      x.tags = on ? x.tags.filter((t) => t !== tag.value) : [...x.tags, tag.value];
                    })
                  }
                >
                  {tag.label}
                </button>
              );
            })}
            {hints.length > 0 && (
              <p className="menu-editor-hint">
                Ingredient allergen labels: <b>{hints.join(", ")}</b>. Check these before choosing tags; tags are shown to customers exactly as you set them.
              </p>
            )}
          </div>
          <label className="menu-switch">
            <Switch checked={item.showImage} onCheckedChange={(showImage) => change((x) => { x.showImage = showImage; })} />
            Show a photo for this dish
          </label>
          {item.showImage && (
            <ImagePicker
              label="Dish photo"
              value={item.imageUrl}
              suggestions={recipeImages}
              onChange={(imageUrl) => change((x) => { x.imageUrl = imageUrl; })}
            />
          )}
          <Button variant="ghost" size="sm" onClick={remove}>
            <Trash2 size={14} /> Remove dish
          </Button>
        </div>
      </details>
    </li>
  );
}

function DesignTab({ menu, update }: TabProps) {
  const { s } = useOps();
  const theme = menu.theme;
  const recipeImages = s.recipes.map((r) => r.imageUrl || "").filter(Boolean);
  return (
    <>
      <EditorGroup title="Layout">
        <div className="menu-choice-grid">
          {menuLayouts.map((layout) => (
            <button
              key={layout.value}
              type="button"
              aria-pressed={theme.layout === layout.value}
              className={`menu-layout-choice menu-layout-choice--${layout.value}`}
              onClick={() => update((d) => { d.theme.layout = layout.value; })}
            >
              <span aria-hidden="true" className="menu-layout-choice__sketch" />
              <strong>{layout.label}</strong>
              <small>{layout.hint}</small>
            </button>
          ))}
        </div>
      </EditorGroup>
      <EditorGroup title="Background" hint="Text colour adjusts automatically so the menu stays readable.">
        <div className="menu-segmented" role="group" aria-label="Background type">
          {(
            [
              ["brand", "Brand colour"],
              ["colour", "Custom colour"],
              ["image", "Photo"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              aria-pressed={theme.background.kind === kind}
              onClick={() =>
                update((d) => {
                  d.theme.background.kind = kind;
                  d.theme.background.value =
                    kind === "brand" ? "cream" : kind === "colour" ? "#f4efe6" : menuImageLibrary[0];
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        {theme.background.kind === "brand" && (
          <div className="menu-swatches">
            {Object.entries(menuBackgrounds).map(([key, swatch]) => (
              <button
                key={key}
                type="button"
                aria-pressed={theme.background.value === key}
                title={swatch.label}
                onClick={() => update((d) => { d.theme.background.value = key; })}
              >
                <span style={{ background: swatch.colour }} />
                {swatch.label}
              </button>
            ))}
          </div>
        )}
        {theme.background.kind === "colour" && (
          <label className="menu-colour-input">
            <input
              type="color"
              value={theme.background.value}
              onChange={(event) => update((d) => { d.theme.background.value = event.target.value; })}
            />
            <span>{theme.background.value}</span>
          </label>
        )}
        {theme.background.kind === "image" && (
          <>
            <ImagePicker
              label="Background photo"
              value={theme.background.value}
              suggestions={recipeImages}
              required
              onChange={(value) => update((d) => { d.theme.background.value = value; })}
            />
            <label className="menu-range">
              <span>Darken photo · {Math.round(Math.max(0.25, theme.background.overlay) * 100)}%</span>
              <input
                type="range"
                min={0.25}
                max={0.9}
                step={0.05}
                value={Math.max(0.25, theme.background.overlay)}
                onChange={(event) => update((d) => { d.theme.background.overlay = Number(event.target.value); })}
              />
            </label>
          </>
        )}
      </EditorGroup>
      <EditorGroup title="Accent colour">
        <div className="menu-swatches">
          {Object.entries(menuAccents).map(([key, swatch]) => (
            <button
              key={key}
              type="button"
              aria-pressed={theme.accent === key}
              onClick={() => update((d) => { d.theme.accent = key as keyof typeof menuAccents; })}
            >
              <span style={{ background: swatch.colour }} />
              {swatch.label}
            </button>
          ))}
        </div>
      </EditorGroup>
      <EditorGroup title="Header image">
        <ImagePicker
          label="Header image"
          value={theme.heroImageUrl}
          suggestions={recipeImages}
          onChange={(heroImageUrl) => update((d) => { d.theme.heroImageUrl = heroImageUrl; })}
        />
      </EditorGroup>
      <EditorGroup title="Text size">
        <div className="menu-segmented" role="group" aria-label="Text size">
          {(
            [
              [0.9, "Compact"],
              [1, "Standard"],
              [1.1, "Large"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={theme.fontScale === value}
              onClick={() => update((d) => { d.theme.fontScale = value; })}
            >
              {label}
            </button>
          ))}
        </div>
      </EditorGroup>
    </>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="menu-icon-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function ImagePicker({
  label,
  value,
  onChange,
  suggestions = [],
  required = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  suggestions?: string[];
  required?: boolean;
}) {
  const [library, setLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const images = [...new Set([...suggestions, ...menuImageLibrary])];
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw Error(result.error || "Upload failed");
      onChange(result.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="menu-image-picker">
      <span className="menu-image-picker__label">{label}</span>
      <div className="menu-image-picker__row">
        <div className="menu-image-picker__thumb">
          {value ? (
            <Image src={value} alt="" width={120} height={80} unoptimized />
          ) : (
            <ImagePlus size={20} aria-hidden="true" />
          )}
        </div>
        <div className="menu-image-picker__buttons">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
            <Upload size={14} /> {uploading ? "Uploading…" : "Upload"}
          </Button>
          <Button type="button" variant="outline" size="sm" aria-expanded={library} onClick={() => setLibrary(!library)}>
            <ImagePlus size={14} /> Choose photo
          </Button>
          {value && !required && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X size={14} /> Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>
      {error && <p role="alert" className="error-message">{error}</p>}
      {library && (
        <div className="menu-image-library" role="listbox" aria-label={`${label} library`}>
          {images.map((src) => (
            <button
              key={src}
              type="button"
              role="option"
              aria-selected={src === value}
              onClick={() => {
                onChange(src);
                setLibrary(false);
              }}
            >
              <Image src={src} alt="" width={120} height={80} unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
