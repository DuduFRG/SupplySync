import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Banner, Screen, Text } from '@/components/ui';
import { LEGAL_DOCUMENTS, VERSAO } from '@/legal/documents';
import { colors, space } from '@/theme';

export default function LegalDocumentScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const document = doc === 'termos' || doc === 'privacidade' ? LEGAL_DOCUMENTS[doc] : null;

  if (!document) {
    return (
      <Screen modal back="close" title="Documento">
        <Banner>Documento não encontrado.</Banner>
      </Screen>
    );
  }

  return (
    <Screen modal back="close" title={document.title} subtitle={`Versão de ${VERSAO}`}>
      <Text color={colors.textSecondary}>{document.intro}</Text>
      {document.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text variant="headline" accessibilityRole="header">
            {section.title}
          </Text>
          {section.paragraphs.map((p) => (
            <Text key={p.slice(0, 40)} selectable>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.md },
});
