import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { ScrollView, FlatList } from "react-native";

export function useScrollToTop() {
  const ref = useRef<ScrollView>(null);
  useFocusEffect(
    useCallback(() => {
      setTimeout(() => ref.current?.scrollTo({ y: 0, animated: false }), 50);
    }, [])
  );
  return ref;
}

export function useFlatListScrollToTop() {
  const ref = useRef<FlatList>(null);
  useFocusEffect(
    useCallback(() => {
      setTimeout(() => ref.current?.scrollToOffset({ offset: 0, animated: false }), 50);
    }, [])
  );
  return ref;
}
