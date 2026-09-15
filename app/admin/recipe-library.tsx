"use client";
import { useState } from "react";
import { type Recipe, money, recipeCost, today } from "@/lib/domain";
import { seasons, symbols } from "@/lib/operations";
import { useOps } from "./ops-context";
import { Panel, GridTable } from "./admin-client";
import { Field, Pick } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
export function DishImage({ src, name }: { src?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setBroken(true)}
      className="dish-image"
    />
  ) : (
    <div className="dish-image image-placeholder">
      <span>◌</span>Dish photo to add
    </div>
  );
}
export function RecipeSymbols({ recipe }: { recipe: Recipe }) {
  const { s } = useOps();
  const tags = [
    ...new Set(
      recipe.lines
        .map(
          (l) => s.ingredients.find((i) => i.id === l.ingredientId)?.category,
        )
        .filter(Boolean),
    ),
  ];
  return (
    <div className="recipe-symbols">
      {tags.map((c) => (
        <span key={c} title={c}>
          <span aria-hidden="true">{symbols[c!]}</span> {c}
        </span>
      ))}
    </div>
  );
}
export function RecipeLibrary({ onEdit }: { onEdit: (r: Recipe) => void }) {
  const { s, href } = useOps();
  const [year, setYear] = useState(today().slice(0, 4)),
    [season, setSeason] = useState("all"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const years = [
    ...new Set([
      Number(today().slice(0, 4)),
      ...s.recipes.flatMap((r) => (r.collections || []).map((c) => c.year)),
    ]),
  ]
    .sort((a, b) => b - a)
    .map(String);
  const filtered = s.recipes.filter(
    (r) =>
      (season === "all" ||
        (r.collections || []).some(
          (c) => c.year === Number(year) && c.season === season,
        )) &&
      `${r.name} ${r.variant}`.toLowerCase().includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12)),
    current = Math.min(page, pages - 1);
  const recipe = s.recipes.find((r) => r.id === selected);
  return (
    <>
      <div className="recipe-toolbar">
        <Pick
          label="Collection year"
          value={year}
          onChange={(v) => {
            setYear(v);
            setPage(0);
          }}
          options={years}
        />
        <Button
          variant={season === "all" ? "default" : "outline"}
          onClick={() => {
            setSeason("all");
            setPage(0);
          }}
        >
          All recipes
        </Button>
        <Field
          label="Search dishes and variants"
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(0);
          }}
        />
      </div>
      <div className="season-columns">
        {seasons.map((name) => (
          <button
            key={name}
            className={`season-column ${season === name ? "selected" : ""}`}
            aria-pressed={season === name}
            onClick={() => {
              setSeason(name);
              setPage(0);
            }}
          >
            <img src={`/images/${name.toLowerCase()}.svg`} alt="" />
            <span>
              {name}
              <small>{year} collection</small>
            </span>
          </button>
        ))}
      </div>
      <div className="recipe-grid">
        {filtered.slice(current * 12, current * 12 + 12).map((r) => (
          <button
            className="recipe-card"
            key={r.id}
            onClick={() => setSelected(r.id)}
          >
            <DishImage key={r.imageUrl} src={r.imageUrl} name={r.name} />
            <div>
              <h3>{r.name}</h3>
              <p>{r.variant}</p>
              <RecipeSymbols recipe={r} />
              <strong>
                {money(Math.round(recipeCost(s, r)))} <small>/ portion</small>
              </strong>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p className="empty-state">
          No recipes in this collection yet. Add a recipe or assign an existing
          dish.
        </p>
      )}
      <div className="recipe-pagination">
        <Button
          variant="outline"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          Previous
        </Button>
        <span>
          {filtered.length} recipes · Page {current + 1} of {pages}
        </span>
        <Button
          variant="outline"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </Button>
      </div>
      {recipe && (
        <Panel
          title={`${recipe.name} · ${recipe.variant}`}
          action={
            <Button onClick={() => onEdit(structuredClone(recipe))}>
              Edit recipe
            </Button>
          }
        >
          <div className="recipe-detail">
            <DishImage
              key={recipe.imageUrl}
              src={recipe.imageUrl}
              name={recipe.name}
            />
            <div>
              <RecipeSymbols recipe={recipe} />
              <h3>{money(Math.round(recipeCost(s, recipe)))} per portion</h3>
              <p>Includes usable-yield allowances.</p>
              <GridTable
                heads={[
                  "Ingredient",
                  "Net quantity",
                  "Yield",
                  "Gross cost",
                  "Supplier",
                ]}
                rows={recipe.lines.map((l) => {
                  const i = s.ingredients.find((i) => i.id === l.ingredientId)!;
                  return [
                    <span key="cell-0">
                      {i.category && symbols[i.category]} {i.name}
                      <small className="subtext">
                        Allergens: {i.allergens || "Not recorded"}
                      </small>
                    </span>,
                    `${l.quantity} ${i.unit}`,
                    `${i.yield * 100}%`,
                    money(
                      Math.round(
                        ((l.quantity / i.yield) * i.packCost) / i.packQuantity,
                      ),
                    ),
                    <a key="cell-4" href={href("suppliers")}>
                      {s.suppliers.find((x) => x.id === i.supplierId)?.name ||
                        "Assign supplier"}
                    </a>,
                  ];
                })}
              />
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
export function RecipeMetadata({
  recipe,
  onChange,
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
}) {
  const [year, setYear] = useState(today().slice(0, 4));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  async function uploadImage(file?: File) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) throw Error(result.error || "Upload failed");
      if (!result.url) throw Error("Upload did not return an image URL");
      onChange({ ...recipe, imageUrl: result.url });
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="wide">
      <label>
        Dish image (JPG, PNG or WebP; max 4 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(event) => void uploadImage(event.target.files?.[0])}
        />
      </label>
      {uploading && <p>Uploading image…</p>}
      {uploadError && <p role="alert">{uploadError}</p>}
      <Field
        label="Finished-dish image URL (or paste an HTTPS URL)"
        value={recipe.imageUrl || ""}
        onChange={(imageUrl) => onChange({ ...recipe, imageUrl })}
      />
      {recipe.imageUrl && (
        <div className="image-preview">
          <DishImage
            key={recipe.imageUrl}
            src={recipe.imageUrl}
            name={recipe.name}
          />
        </div>
      )}
      <Field
        label="Assign to collection year"
        type="number"
        value={year}
        onChange={setYear}
      />
      <div className="season-checks">
        {seasons.map((season) => (
          <label key={season}>
            <input
              type="checkbox"
              checked={(recipe.collections || []).some(
                (c) => c.year === Number(year) && c.season === season,
              )}
              onChange={(e) =>
                onChange({
                  ...recipe,
                  collections: e.target.checked
                    ? [
                        ...(recipe.collections || []),
                        { year: Number(year), season },
                      ]
                    : (recipe.collections || []).filter(
                        (c) => c.year !== Number(year) || c.season !== season,
                      ),
                })
              }
            />
            {season}
          </label>
        ))}
      </div>
      <p className="panel-note">
        Collections:{" "}
        {(recipe.collections || [])
          .map((c) => `${c.season} ${c.year}`)
          .join(", ") || "Unassigned — available in All recipes"}
      </p>
    </div>
  );
}
