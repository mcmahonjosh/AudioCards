import 'react-native-gifted-charts';

declare module 'react-native-gifted-charts' {
  interface BarChartPropsType {
    remainingScrollViewProps?: Record<string, unknown>;
  }
}
