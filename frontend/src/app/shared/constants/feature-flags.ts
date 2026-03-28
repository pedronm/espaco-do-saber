import { environment } from '../../../environments/environment';

type FeatureName = 'videoOn' | 'streamOn' | 'muxOn' | 'r2On' | 'healthchecksOn' | 'adminAdmissionOn';

export function isFeatureOn(featureName: FeatureName): boolean {
  const features = environment.features || {};
  // Admin approval can be toggled independently from the global media feature gate.
  if (features.globalOn === false && featureName !== 'adminAdmissionOn') {
    return false;
  }

  return features[featureName] === true;
}

export function isFeatureVideoOn(): boolean {
  return isFeatureOn('videoOn');
}

export function isFeatureStreamOn(): boolean {
  return isFeatureOn('streamOn');
}

export function isFeatureMuxOn(): boolean {
  return isFeatureOn('muxOn');
}

export function isFeatureR2On(): boolean {
  return isFeatureOn('r2On');
}

export function isFeatureHealthchecksOn(): boolean {
  return isFeatureOn('healthchecksOn');
}

export function isFeatureAdminAdmissionOn(): boolean {
  return isFeatureOn('adminAdmissionOn');
}
