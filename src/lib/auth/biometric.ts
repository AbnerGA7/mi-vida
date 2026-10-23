import * as LocalAuthentication from 'expo-local-authentication';

export async function canUseBiometrics() {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

export async function unlockWithBiometrics(reason = 'Desbloquea Mi Vida') {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancelar',
    // Permite el PIN del celular como respaldo si la huella falla.
    disableDeviceFallback: false,
  });
  return result.success;
}
