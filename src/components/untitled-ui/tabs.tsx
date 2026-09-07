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
  disabled = false,
}: {
  items: Array<{ id: string; label: string; content: ReactNode }>;
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  label: string;
  keepMounted?: boolean;
  disabled?: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = strip.current;
    if (!root) return;
    const revealSelected = () => {
      const active = root.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const left = active.offsetLeft;
      if (left < root.scrollLeft) root.scrollLeft = left;
      else if (left + active.offsetWidth > root.scrollLeft + root.clientWidth)
        root.scrollLeft = left + active.offsetWidth - root.clientWidth;
    };
    revealSelected();
    const observer = new ResizeObserver(revealSelected);
    observer.observe(root);
    if (root.firstElementChild) observer.observe(root.firstElementChild);
    return () => observer.disconnect();
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
            <Tab key={item.id} id={item.id} className={styles.tab} isDisabled={disabled}>
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
