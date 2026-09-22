import { useCallback, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, View } from "react-native";

/** Keyboard coordinates are screen-relative, even inside padded/tab layouts. */
export function KeyboardFrame({ children }: { children: ReactNode }) {
  const frame = useRef<View>(null);
  const [top, setTop] = useState(0);
  const measure = useCallback(() => {
    frame.current?.measureInWindow((_x, y) => setTop(Math.max(0, y)));
  }, []);
  return (
    <View ref={frame} collapsable={false} onLayout={measure} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={top}
        style={{ flex: 1 }}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}
