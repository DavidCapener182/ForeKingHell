export function useRouter() {
  return {
    push(href: string) {
      window.history.pushState(null, "", href);
    },
    refresh() {},
  };
}
