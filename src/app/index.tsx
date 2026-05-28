import { Text, View } from "react-native";

export default function HomePage() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-950 px-4">
      <Text className="mb-2 text-2xl font-semibold text-cyan-300">Welcome to Kometi App</Text>
      <Text className="text-center text-sm text-slate-300">
        The app is now ready for Expo + NativeWind UI design work.
      </Text>
    </View>
  );
}
