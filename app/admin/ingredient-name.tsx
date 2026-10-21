"use client";

import { IngredientInfo } from "@/components/ingredient-info";
import { useOps } from "./ops-context";

/** Shows a catalogue ingredient's name with its UK storage and allergen guide on hover or tap. */
export function IngredientName({ id, name }: { id?: string; name?: string }) {
  const { s } = useOps();
  const ingredient = s.ingredients.find((item) => item.id === id);
  if (!ingredient) return <>{name || "Unknown ingredient"}</>;
  return <IngredientInfo name={name || ingredient.name} category={ingredient.category} allergens={ingredient.allergens} />;
}
