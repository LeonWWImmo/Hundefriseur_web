"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./AdminMenu.module.css";

type AdminMenuProps = {
  currentPath: "/admin/kalender" | "/admin/buchungen";
};

const items = [
  { href: "/admin/kalender", label: "Kalender" },
  { href: "/admin/buchungen", label: "Buchungen" },
] as const;

export default function AdminMenu({ currentPath }: AdminMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className={styles.menuWrap} ref={rootRef}>
      <button
        type="button"
        className={styles.burgerBtn}
        aria-label="Admin Menü öffnen"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.burgerLines} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open ? (
        <div className={styles.menuPanel}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.menuLink} ${currentPath === item.href ? styles.menuLinkActive : ""}`.trim()}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <form action="/api/admin/logout" method="post">
            <button type="submit" className={styles.menuLogout}>
              Logout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
