import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, space } from '@/theme';
import { Text } from './ui';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const asString = (v: unknown) => (typeof v === 'string' ? v : null);
const rawKey = asString(extra.turnstileSiteKey);
const rawBase = asString(extra.turnstileBaseUrl);
const SITE_KEY = rawKey && /^[\w-]{8,100}$/.test(rawKey) ? rawKey : null;
const BASE_URL = rawBase && /^https:\/\/[a-z0-9.-]+$/i.test(rawBase) ? rawBase : null;

export const humanCheckEnabled = !!(SITE_KEY && BASE_URL);

const html = (siteKey: string) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready&render=explicit" async defer></script>
</head><body style="margin:0;display:flex;justify-content:center;background:transparent">
<div id="w"></div>
<script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function ready(){turnstile.render('#w',{sitekey:'${siteKey}',theme:'light',language:'pt-br',
callback:function(t){send({type:'token',token:t});},
'expired-callback':function(){send({type:'expired'});},
'error-callback':function(){send({type:'error'});}});}
</script></body></html>`;

interface HumanCheckProps {
  onToken: (token: string | undefined) => void;
  /** Mude o valor para gerar um novo desafio (tokens valem uma única vez). */
  resetKey?: number;
}

/**
 * Verificação antibot (Cloudflare Turnstile) em uma WebView isolada.
 * A validação real acontece na API com a chave secreta; o app só repassa o token.
 * Sem chave configurada (desenvolvimento), o componente não aparece.
 */
export function HumanCheck({ onToken, resetKey = 0 }: HumanCheckProps) {
  useEffect(() => {
    if (!humanCheckEnabled) onToken(undefined);
  }, [onToken]);

  if (!humanCheckEnabled) return null;

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; token?: string };
      if (msg.type === 'token' && typeof msg.token === 'string' && msg.token.length < 4096) onToken(msg.token);
      else onToken(undefined);
    } catch {
      onToken(undefined);
    }
  };

  return (
    <View style={styles.wrap}>
      <WebView
        key={resetKey}
        source={{ html: html(SITE_KEY!), baseUrl: BASE_URL! }}
        onMessage={onMessage}
        originWhitelist={[BASE_URL!, 'https://challenges.cloudflare.com']}
        onShouldStartLoadWithRequest={(req) =>
          req.url === 'about:blank' || req.url.startsWith(BASE_URL!) || req.url.startsWith('https://challenges.cloudflare.com')
        }
        allowFileAccess={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        style={styles.web}
      />
      <Text variant="caption" color={colors.textSecondary} align="center">
        Proteção contra robôs
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  web: { height: 70, backgroundColor: 'transparent' },
});
