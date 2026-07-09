import Constants from 'expo-constants';

const DEFAULT_PRIVACY_POLICY_URL = 'https://mcmahonjosh.github.io/AudioCards/privacy';
const DEFAULT_SUPPORT_URL = 'https://mcmahonjosh.github.io/AudioCards/support';

export function getAppUrls(): { privacyPolicyUrl: string; supportUrl: string } {
  const extra = Constants.expoConfig?.extra as
    | { privacyPolicyUrl?: string; supportUrl?: string }
    | undefined;

  return {
    privacyPolicyUrl: extra?.privacyPolicyUrl ?? DEFAULT_PRIVACY_POLICY_URL,
    supportUrl: extra?.supportUrl ?? DEFAULT_SUPPORT_URL,
  };
}
