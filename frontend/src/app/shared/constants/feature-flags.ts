import { environment } from '../../../environments/environment';

type FeatureName = 'videoOn' | 'streamOn' | 'muxOn' | 'r2On' | 'healthchecksOn';

export function isFeatureOn(featureName: FeatureName): boolean {
  const features = environment.features || {};
  if (features.globalOn === false) {
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
