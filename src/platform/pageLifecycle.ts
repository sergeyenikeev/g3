type PageLifecycleCallbacks = {
  hide: () => void;
  show: () => void;
};

export function bindPageLifecycle(callbacks: PageLifecycleCallbacks): () => void {
  const onVisibilityChange = () => {
    if (document.hidden) callbacks.hide();
    else callbacks.show();
  };

  const onBlur = () => callbacks.hide();
  const onFocus = () => {
    if (!document.hidden) callbacks.show();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
  };
}
