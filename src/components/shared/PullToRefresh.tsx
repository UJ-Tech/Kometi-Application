// src/components/shared/PullToRefresh.tsx
// Stylized pull-to-refresh container wrapper.
// Wraps ScrollView with standard RefreshControl tailored to the Kometi dark/gold design palette.

import React from "react";
import { ScrollView, RefreshControl, type ScrollViewProps } from "react-native";
import { COLORS } from "../../constants/theme";

interface PullToRefreshProps extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({
  refreshing,
  onRefresh,
  children,
  ...scrollViewProps
}: PullToRefreshProps) {
  return (
    <ScrollView
      {...scrollViewProps}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.brand[500]}
          colors={[COLORS.brand[500], COLORS.gold[500]]}
          progressBackgroundColor={COLORS.surface.card}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

export default PullToRefresh;
