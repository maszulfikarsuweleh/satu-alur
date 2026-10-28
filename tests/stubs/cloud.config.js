/**
 * Stub src/cloud.config.js untuk test.
 * Default: tidak terkonfigurasi, sehingga getCloud() memakai mock cloud.
 * Set globalThis.__TEST_CLOUD_CONFIG__ untuk menguji jalur cloud asli.
 */
const override = globalThis.__TEST_CLOUD_CONFIG__

export const publicConfig = override ?? {
  resourceId: '',
  endpoint: '',
  oauthRelayBaseUrl: '',
  publishableKey: '',
}

export const isCloudConfigured = () =>
  Boolean(publicConfig.endpoint && publicConfig.publishableKey)
