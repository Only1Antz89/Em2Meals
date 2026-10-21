import Image from "next/image";
import type { CSSProperties } from "react";
import { RestrictedMarkdown } from "./restricted-markdown";
import {
  formatMenuPrice,
  menuAccents,
  menuBackgroundColour,
  menuTags,
  menuTone,
  minimumImageOverlay,
  type PublicMenu,
} from "@/lib/menu-theme";

const tagLabel = (value: string) =>
  menuTags.find((tag) => tag.value === value)?.label || value;

// The single renderer used by the public /menu page, the owner preview and the
// printable PDF, so all three always match.
export function MenuDocument({ menu }: { menu: PublicMenu }) {
  const { theme } = menu;
  const tone = menuTone(theme);
  const background = theme.background;
  const style = {
    "--menu-bg": menuBackgroundColour(theme),
    "--menu-accent": menuAccents[theme.accent]?.colour ?? menuAccents.gold.colour,
    "--menu-scale": theme.fontScale,
    "--menu-overlay": Math.max(minimumImageOverlay, background.overlay),
  } as CSSProperties;
  const usedTags = [
    ...new Set(
      menu.sections.flatMap((section) =>
        section.items.flatMap((item) => item.tags),
      ),
    ),
  ];
  return (
    <article
      id="menu-print"
      className={`menu-doc menu-doc--${theme.layout} menu-doc--${tone}`}
      style={style}
      aria-label={menu.title}
    >
      {background.kind === "image" && background.value && (
        <div className="menu-doc__backdrop" aria-hidden="true">
          <Image src={background.value} alt="" fill unoptimized sizes="100vw" />
        </div>
      )}
      <header className="menu-doc__hero">
        {theme.heroImageUrl && (
          <div className="menu-doc__hero-image">
            <Image
              src={theme.heroImageUrl}
              alt=""
              width={1400}
              height={520}
              unoptimized
              priority
            />
          </div>
        )}
        <p className="menu-doc__kicker">
          {menu.season} {menu.year} · Fork Goodness Baked
        </p>
        <h1>{menu.title}</h1>
        <span className="menu-doc__rule" aria-hidden="true" />
        {menu.intro && (
          <RestrictedMarkdown source={menu.intro} className="menu-doc__intro" />
        )}
      </header>
      <div className="menu-doc__sections">
        {menu.sections.map((section, sectionIndex) => (
          <section className="menu-doc__section" key={sectionIndex}>
            {section.imageUrl && (
              <div className="menu-doc__section-image">
                <Image
                  src={section.imageUrl}
                  alt=""
                  width={1000}
                  height={360}
                  unoptimized
                />
              </div>
            )}
            <h2>{section.title}</h2>
            {section.description && (
              <RestrictedMarkdown
                source={section.description}
                className="menu-doc__section-intro"
              />
            )}
            <ul className="menu-doc__items">
              {section.items.map((item, itemIndex) => (
                <li
                  className={`menu-doc__item${item.imageUrl ? " menu-doc__item--image" : ""}`}
                  key={itemIndex}
                >
                  {item.imageUrl && (
                    <div className="menu-doc__dish-image">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={640}
                        height={480}
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="menu-doc__dish">
                    <div className="menu-doc__dish-head">
                      <h3>{item.name}</h3>
                      {item.tags.length > 0 && (
                        <span className="menu-doc__tags">
                          {item.tags.map((tag) => (
                            <abbr key={tag} title={tagLabel(tag)}>
                              {tag === "SPICY" ? "🌶" : tag}
                            </abbr>
                          ))}
                        </span>
                      )}
                      {menu.showPrices && item.price != null && (
                        <>
                          <span className="menu-doc__leader" aria-hidden="true" />
                          <span className="menu-doc__price">
                            {formatMenuPrice(item.price)}
                          </span>
                        </>
                      )}
                    </div>
                    {item.description && (
                      <RestrictedMarkdown
                        source={item.description}
                        className="menu-doc__dish-description"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <footer className="menu-doc__footer">
        {menu.footerNote && <RestrictedMarkdown source={menu.footerNote} />}
        {usedTags.length > 0 && (
          <p className="menu-doc__legend">
            {usedTags
              .map((tag) => `${tag === "SPICY" ? "🌶" : tag} ${tagLabel(tag)}`)
              .join(" · ")}
          </p>
        )}
        <p className="menu-doc__allergy">
          Our kitchen handles common allergens. Please tell us about any
          allergies or dietary requirements before booking.
        </p>
      </footer>
    </article>
  );
}
