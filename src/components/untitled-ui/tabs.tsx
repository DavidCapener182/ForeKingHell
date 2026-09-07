"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTabList, useTab, useTabPanel } from "react-aria/useTabList";
import { useFocusRing } from "react-aria/useFocusRing";
import { mergeProps } from "react-aria/mergeProps";
import { useTabListState, type TabListState } from "react-stately/useTabListState";
import { Item } from "react-stately/Item";

type TabItem = { id: string; label: string; content: ReactNode };
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
  items: TabItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  label: string;
  keepMounted?: boolean;
  disabled?: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const state = useTabListState<TabItem>({
    items,
    selectedKey,
    onSelectionChange: (key) => onSelectionChange(String(key)),
    isDisabled: disabled,
    children: (item) => (
      <Item key={item.id} textValue={item.label}>
        {item.label}
      </Item>
    ),
  });
  const { tabListProps } = useTabList({ "aria-label": label, isDisabled: disabled }, state, list);
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
    <div className={styles.root}>
      <div className={styles.strip} ref={strip}>
        <div {...tabListProps} ref={list} className={styles.list}>
          {items.map((item) => (
            <UnderlineTab key={item.id} item={item} state={state} instanceId={instanceId} />
          ))}
        </div>
      </div>
      {items.map((item) => (
        <UnderlinePanel
          key={item.id}
          item={item}
          state={state}
          instanceId={instanceId}
          keepMounted={keepMounted}
        />
      ))}
    </div>
  );
}

function UnderlineTab({
  item,
  state,
  instanceId,
}: {
  item: TabItem;
  state: TabListState<TabItem>;
  instanceId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { tabProps, isSelected, isDisabled } = useTab({ key: item.id }, state, ref);
  const { focusProps, isFocusVisible } = useFocusRing();
  return (
    <div
      {...mergeProps(tabProps, focusProps)}
      ref={ref}
      id={`${instanceId}-tab-${item.id}`}
      aria-controls={`${instanceId}-panel-${item.id}`}
      className={styles.tab}
      data-selected={isSelected || undefined}
      data-disabled={isDisabled || undefined}
      data-focus-visible={isFocusVisible || undefined}
    >
      {item.label}
    </div>
  );
}

function UnderlinePanel({
  item,
  state,
  instanceId,
  keepMounted,
}: {
  item: TabItem;
  state: TabListState<TabItem>;
  instanceId: string;
  keepMounted: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { tabPanelProps } = useTabPanel({ id: item.id }, state, ref);
  const { focusProps, isFocusVisible } = useFocusRing();
  const selected = state.selectedKey === item.id;
  if (!selected && !keepMounted) return null;
  return (
    <div
      {...mergeProps(tabPanelProps, focusProps)}
      ref={ref}
      id={`${instanceId}-panel-${item.id}`}
      aria-labelledby={`${instanceId}-tab-${item.id}`}
      className={styles.panel}
      hidden={!selected}
      inert={!selected}
      data-inert={!selected || undefined}
      data-focus-visible={isFocusVisible || undefined}
    >
      {item.content}
    </div>
  );
}
