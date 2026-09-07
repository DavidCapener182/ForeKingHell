"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import styles from "./tabs.module.css";

/** Explicit React Aria selection contract; local composition of Untitled UI Underline tabs. */
export function UntitledTabs({
  items,
  selectedKey,
  onSelectionChange,
  label,
  keepMounted = false,
}: {
  items: Array<{ id: string; label: string; content: ReactNode }>;
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  label: string;
  keepMounted?: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = strip.current;
    const active = root?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!root || !active) return;
    const left = active.offsetLeft;
    if (left < root.scrollLeft) root.scrollLeft = left;
    else if (left + active.offsetWidth > root.scrollLeft + root.clientWidth)
      root.scrollLeft = left + active.offsetWidth - root.clientWidth;
  }, [selectedKey]);
  return (
    <Tabs
      className={styles.root}
      selectedKey={selectedKey}
      onSelectionChange={(key) => onSelectionChange(String(key))}
    >
      <div className={styles.strip} ref={strip}>
        <TabList aria-label={label} className={styles.list}>
          {items.map((item) => (
            <Tab key={item.id} id={item.id} className={styles.tab}>
              {item.label}
            </Tab>
          ))}
        </TabList>
      </div>
      {items.map((item) => (
        <TabPanel
          key={item.id}
          id={item.id}
          shouldForceMount={keepMounted}
          className={styles.panel}
        >
          {item.content}
        </TabPanel>
      ))}
    </Tabs>
  );
}
