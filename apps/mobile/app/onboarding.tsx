import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { splitEvenly, type ItemStatus } from '@supplysync/shared';
import { useSession } from '@/auth/AuthProvider';
import { Button, Card, Chip, IconButton, PressableScale, StatusPill, Text } from '@/components/ui';
import { STARTER_ICONS, STARTER_ITEMS } from '@/lib/categories';
import { formatCents } from '@/lib/format';
import { EmptyingShelf, RotationRing } from '@/onboarding/Illustrations';
import { colors, palette, radius, space } from '@/theme';

/**
 * ONBOARDING
 *
 * Deliberadamente sem botão "pular". O objetivo não é chegar rápido ao app,
 * e sim sair daqui entendendo três coisas:
 *   1. O problema existe e é invisível (capítulos 1 a 3).
 *   2. Como o SupplySync resolve, experimentando cada mecânica (capítulos 4 a 7).
 *   3. O combinado que faz o sistema funcionar (capítulo 8).
 * Capítulos interativos só liberam o avanço depois da interação.
 */

const CHAPTERS = [
  'A lista invisível',
  'Sua casa',
  'O que acontece',
  'A causa real',
  'Sinalize',
  'De quem é a vez',
  'Divida sem planilha',
  'O combinado',
] as const;

const REACTIONS = [
  {
    key: 'rush',
    icon: 'run-fast' as const,
    label: 'Alguém sai correndo para comprar',
    insight: 'Compra de emergência sai mais cara e interrompe o dia. O problema não foi falta de dinheiro, foi falta de aviso.',
  },
  {
    key: 'double',
    icon: 'content-copy' as const,
    label: 'Duas pessoas compram a mesma coisa',
    insight: 'Compra em dobro é dinheiro parado no armário. Acontece porque ninguém sabe o que o outro já fez.',
  },
  {
    key: 'argue',
    icon: 'account-voice' as const,
    label: 'Vira discussão sobre de quem era a vez',
    insight: 'A briga raramente é sobre papel higiênico. É sobre a sensação de que só uma pessoa se lembra das coisas.',
  },
  {
    key: 'wait',
    icon: 'timer-sand' as const,
    label: 'Fica faltando até alguém lembrar',
    insight: 'Quando ninguém é responsável, todo mundo espera. A falta vira rotina, e a rotina vira atrito.',
  },
];

const PACT = [
  { title: 'Usei o último, eu sinalizo.', body: 'Leva dois segundos e evita a próxima falta.' },
  { title: 'É minha vez, eu compro ou aviso.', body: 'Se não puder, repasse. O silêncio é o que gera atrito.' },
  { title: 'Comprei, eu registro o valor.', body: 'Assim ninguém fica no prejuízo nem precisa cobrar.' },
];

const DEMO_PEOPLE = ['Você', 'Ana', 'Léo'];
const DEMO_AMOUNT = 8990;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding, status } = useSession();

  const [step, setStep] = useState(0);
  const [pains, setPains] = useState<string[]>([]);
  const [reaction, setReaction] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<ItemStatus>('OK');
  const [turn, setTurn] = useState(0);
  const [splitWith, setSplitWith] = useState<string[]>(DEMO_PEOPLE);
  const [pact, setPact] = useState([false, false, false]);
  const [finishing, setFinishing] = useState(false);

  const demoItemName = useMemo(
    () => STARTER_ITEMS.find((i) => i.key === pains[0])?.name ?? 'Papel higiênico',
    [pains],
  );

  const canContinue = [
    true,
    pains.length > 0,
    reaction !== null,
    true,
    demoStatus !== 'OK',
    turn > 0,
    true,
    pact.every(Boolean),
  ][step]!;

  const cta = [
    'Isso acontece aqui em casa',
    'Continuar',
    'Continuar',
    'Quero ver como funciona',
    'Próximo passo',
    'Próximo passo',
    'Entendi',
    'Fazer parte do combinado',
  ][step]!;

  const lockedHint = [
    null,
    'Marque ao menos um item para continuar',
    'Escolha uma opção para continuar',
    null,
    'Toque em um dos botões do item para experimentar',
    'Toque em "Registrar compra" para ver a vez passar',
    null,
    'Confirme os três hábitos para continuar',
  ][step];

  async function next() {
    if (!canContinue) return;
    if (step < CHAPTERS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    setFinishing(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding({ completedAt: new Date().toISOString(), pains, reaction });
    router.replace(status === 'signedIn' ? '/' : '/sign-up');
  }

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      {/* Progresso */}
      <View style={styles.top}>
        <View style={styles.topRow}>
          {step > 0 ? (
            <IconButton icon="arrow-left" label="Capítulo anterior" onPress={() => setStep((s) => s - 1)} />
          ) : (
            <View style={styles.logo}>
              <MaterialCommunityIcons name="sync" size={18} color={colors.textInverse} />
            </View>
          )}
          <Text variant="label" color={colors.textSecondary}>
            Capítulo {step + 1} de {CHAPTERS.length} · {CHAPTERS[step]}
          </Text>
        </View>
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: CHAPTERS.length, now: step + 1 }}>
          {CHAPTERS.map((c, i) => (
            <View key={c} style={[styles.progressSeg, i <= step && styles.progressSegOn]} />
          ))}
        </View>
      </View>

      {/* Conteúdo do capítulo */}
      <Animated.ScrollView
        key={step}
        entering={FadeIn.duration(300)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <Chapter
            overline="O problema"
            title="Quem comprou o último rolo de papel higiênico?"
            body="Toda casa tem uma lista que ninguém escreveu. Ela só aparece quando algo acaba, quase sempre na pior hora."
          >
            <Reveal delay={2}>
              <EmptyingShelf />
            </Reveal>
            <Reveal delay={3}>
              <Text color={colors.textSecondary}>
                Papel, sabão, filtro, ração. O consumo da casa é contínuo, mas ninguém vê acontecer. Esse é o ponto cego que gera atrito.
              </Text>
            </Reveal>
          </Chapter>
        )}

        {step === 1 && (
          <Chapter
            overline="Sua casa"
            title="O que já acabou por aí sem ninguém perceber?"
            body="Marque o que já faltou na sua casa. Vamos usar isso para montar o seu inventário depois."
          >
            <Reveal delay={2}>
              <View style={styles.chips}>
                {STARTER_ITEMS.map((item) => (
                  <Chip
                    key={item.key}
                    label={item.name}
                    selected={pains.includes(item.key)}
                    onPress={() => setPains((p) => toggle(p, item.key))}
                    icon={
                      <MaterialCommunityIcons
                        name={STARTER_ICONS[item.key] ?? 'package-variant'}
                        size={18}
                        color={pains.includes(item.key) ? colors.primaryPressed : colors.textSecondary}
                      />
                    }
                  />
                ))}
              </View>
            </Reveal>
            {pains.length > 0 && (
              <Insight key={pains.length > 2 ? 'many' : 'few'}>
                {pains.length > 2
                  ? `${pains.length} itens. Cada um é uma pequena decisão que alguém precisa lembrar de tomar. Somando, vira trabalho mental invisível, quase sempre concentrado em uma pessoa só.`
                  : 'Cada item recorrente é uma pequena decisão que alguém precisa lembrar de tomar. Parece pouco, até somar.'}
              </Insight>
            )}
          </Chapter>
        )}

        {step === 2 && (
          <Chapter overline="Seja sincero" title="E quando algo acaba, o que costuma acontecer?" body="Escolha a situação mais comum na sua casa.">
            <View style={styles.list}>
              {REACTIONS.map((r, i) => {
                const selected = reaction === r.key;
                return (
                  <Reveal key={r.key} delay={i + 2}>
                    <PressableScale
                      haptic="selection"
                      onPress={() => setReaction(r.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[styles.option, selected && styles.optionOn]}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconOn]}>
                        <MaterialCommunityIcons name={r.icon} size={22} color={selected ? colors.textInverse : colors.primary} />
                      </View>
                      <Text variant="bodyStrong" style={styles.flex}>
                        {r.label}
                      </Text>
                      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                    </PressableScale>
                  </Reveal>
                );
              })}
            </View>
            {reaction && <Insight key={reaction}>{REACTIONS.find((r) => r.key === reaction)!.insight}</Insight>}
          </Chapter>
        )}

        {step === 3 && (
          <Chapter
            overline="A causa real"
            title="O problema não é a lista. É a invisibilidade."
            body="Listas de compras dizem o que comprar. Mas o atrito nasce antes: ninguém sabe o que está acabando, quem vai comprar e quanto cada um já gastou."
          >
            <Reveal delay={2}>
              <Card style={styles.compareMuted}>
                <Text variant="overline" color={colors.textSecondary}>
                  Lista de compras comum
                </Text>
                <CompareLine ok={false}>Mostra o que comprar, não o que está acabando</CompareLine>
                <CompareLine ok={false}>Ninguém sabe quem vai comprar</CompareLine>
                <CompareLine ok={false}>O dinheiro fica na cabeça de alguém</CompareLine>
              </Card>
            </Reveal>
            <Reveal delay={3}>
              <Card style={styles.compareOn}>
                <Text variant="overline" color={palette.green700}>
                  SupplySync
                </Text>
                <CompareLine ok>Mostra o estado real da casa, na hora</CompareLine>
                <CompareLine ok>Define de quem é a vez, com justiça</CompareLine>
                <CompareLine ok>Divide os custos sem planilha</CompareLine>
              </Card>
            </Reveal>
            <Reveal delay={4}>
              <Text color={colors.textSecondary}>Nos próximos capítulos você vai experimentar cada parte. São três hábitos simples.</Text>
            </Reveal>
          </Chapter>
        )}

        {step === 4 && (
          <Chapter
            overline="Hábito 1 de 3"
            title="Usou o último? Sinalize em um toque."
            body="Marque como Acabando ou Acabou. Se quiser, anexe uma foto. A casa inteira fica sabendo, e quem é a vez recebe o aviso."
          >
            <Reveal delay={2}>
              <Card>
                <View style={styles.demoHead}>
                  <View style={styles.demoIcon}>
                    <MaterialCommunityIcons
                      name={STARTER_ICONS[pains[0] ?? 'toilet-paper'] ?? 'package-variant'}
                      size={24}
                      color={palette.green700}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{demoItemName}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Item essencial
                    </Text>
                  </View>
                  <Animated.View layout={LinearTransition}>
                    <StatusPill status={demoStatus} />
                  </Animated.View>
                </View>
                <View style={styles.demoActions}>
                  <Button label="Acabando" variant="secondary" size="md" full={false} style={styles.flex} onPress={() => setDemoStatus('LOW')} />
                  <Button label="Acabou" variant="danger" size="md" full={false} style={styles.flex} onPress={() => setDemoStatus('OUT')} />
                </View>
              </Card>
            </Reveal>
            {demoStatus !== 'OK' && (
              <Animated.View entering={FadeInUp.springify().damping(16)} key={demoStatus}>
                <View style={styles.notif}>
                  <View style={styles.notifIcon}>
                    <Feather name="bell" size={16} color={colors.textInverse} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="label">
                      {demoItemName} {demoStatus === 'OUT' ? 'acabou' : 'está acabando'}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      A vez de comprar é da Ana. Ela já foi avisada.
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}
          </Chapter>
        )}

        {step === 5 && (
          <Chapter
            overline="Hábito 2 de 3"
            title="Todo mundo sabe de quem é a vez."
            body="Quando algo acaba, o app sugere quem compra. Sem cobrança, sem memória seletiva. Experimente:"
          >
            <Reveal delay={2}>
              <Card>
                <RotationRing names={DEMO_PEOPLE} current={turn % DEMO_PEOPLE.length} />
                <Button
                  label="Registrar compra"
                  icon="shopping-bag"
                  variant="secondary"
                  onPress={() => setTurn((t) => t + 1)}
                  accessibilityHint="Passa a vez para a próxima pessoa"
                />
              </Card>
            </Reveal>
            <Reveal delay={3}>
              <View style={styles.list}>
                <Mode icon="repeat" title="Rodízio" body="Cada reposição, uma pessoa diferente." />
                <Mode icon="star" title="Preferência" body="Aquele item que só uma pessoa sabe escolher." />
                <Mode icon="sliders" title="Equilíbrio" body="Quem gastou menos recentemente compra a próxima." />
              </View>
            </Reveal>
          </Chapter>
        )}

        {step === 6 && (
          <Chapter
            overline="Hábito 3 de 3"
            title="Registrou o valor, a conta se divide sozinha."
            body="O app mantém o saldo de cada pessoa e sugere o acerto mais simples. Toque nos nomes para mudar quem divide."
          >
            <Reveal delay={2}>
              <SplitDemo splitWith={splitWith} onToggle={(p) => setSplitWith((l) => (l.length === 1 && l.includes(p) ? l : toggle(l, p)))} />
            </Reveal>
          </Chapter>
        )}

        {step === 7 && (
          <Chapter
            overline="Último capítulo"
            title="O combinado da casa"
            body="O SupplySync funciona quando todo mundo segue os mesmos três hábitos. Leia e confirme cada um."
          >
            <View style={styles.list}>
              {PACT.map((p, i) => {
                const on = pact[i]!;
                return (
                  <Reveal key={p.title} delay={i + 2}>
                    <PressableScale
                      haptic="selection"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      onPress={() => setPact((arr) => arr.map((v, j) => (j === i ? !v : v)))}
                      style={[styles.option, on && styles.optionOn]}
                    >
                      <View style={[styles.check, on && styles.checkOn]}>{on ? <Feather name="check" size={16} color={colors.textInverse} /> : null}</View>
                      <View style={styles.flex}>
                        <Text variant="bodyStrong">{p.title}</Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {p.body}
                        </Text>
                      </View>
                    </PressableScale>
                  </Reveal>
                );
              })}
            </View>
            <Reveal delay={5}>
              <Text variant="caption" color={colors.textSecondary}>
                Depois você vai convidar as pessoas da sua casa. Elas também vão passar por este combinado.
              </Text>
            </Reveal>
          </Chapter>
        )}
      </Animated.ScrollView>

      {/* Ação */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {!canContinue && lockedHint ? (
          <Text variant="caption" color={colors.textSecondary} align="center">
            {lockedHint}
          </Text>
        ) : null}
        <Button label={cta} onPress={() => void next()} disabled={!canContinue} loading={finishing} icon="arrow-right" iconRight />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function Chapter({ overline, title, body, children }: { overline: string; title: string; body: string; children: ReactNode }) {
  return (
    <View style={styles.chapter}>
      <Reveal delay={0}>
        <Text variant="overline" color={colors.primary}>
          {overline}
        </Text>
        <Text variant="display" style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </Reveal>
      <Reveal delay={1}>
        <Text color={colors.textSecondary}>{body}</Text>
      </Reveal>
      {children}
    </View>
  );
}

function Reveal({ delay, children }: { delay: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.delay(delay * 90).duration(420)}>{children}</Animated.View>;
}

function Insight({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={FadeInUp.duration(380)} style={styles.insight}>
      <Feather name="eye" size={18} color={palette.green700} />
      <Text variant="label" color={palette.green900} style={styles.flex}>
        {children}
      </Text>
    </Animated.View>
  );
}

function CompareLine({ ok, children }: { ok: boolean; children: string }) {
  return (
    <View style={styles.compareLine}>
      <Feather name={ok ? 'check-circle' : 'x-circle'} size={18} color={ok ? palette.green600 : palette.ink400} />
      <Text variant="label" color={ok ? colors.text : colors.textSecondary} style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

function Mode({ icon, title, body }: { icon: 'repeat' | 'star' | 'sliders'; title: string; body: string }) {
  return (
    <View style={styles.mode}>
      <View style={styles.modeIcon}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {body}
        </Text>
      </View>
    </View>
  );
}

function SplitDemo({ splitWith, onToggle }: { splitWith: string[]; onToggle: (p: string) => void }) {
  const shares = splitEvenly(DEMO_AMOUNT, splitWith);
  const owedToYou = shares.filter((s) => s.userId !== 'Você');

  return (
    <Card>
      <View style={styles.demoHead}>
        <View style={styles.demoIcon}>
          <MaterialCommunityIcons name="paw" size={24} color={palette.green700} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Ração 10 kg</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Paga por você
          </Text>
        </View>
        <Text variant="headline">{formatCents(DEMO_AMOUNT)}</Text>
      </View>

      <Text variant="overline" color={colors.textSecondary} style={styles.splitLabel}>
        Dividir com
      </Text>
      <View style={styles.chips}>
        {DEMO_PEOPLE.map((p) => (
          <Chip key={p} label={p} selected={splitWith.includes(p)} onPress={() => onToggle(p)} />
        ))}
      </View>

      <Animated.View layout={LinearTransition} style={styles.splitResult}>
        {owedToYou.length === 0 ? (
          <Text variant="label" color={colors.textSecondary}>
            Compra só sua. Ninguém te deve nada.
          </Text>
        ) : (
          owedToYou.map((s) => (
            <View key={s.userId} style={styles.splitRow}>
              <Text variant="label">{s.userId} te deve</Text>
              <Text variant="bodyStrong" color={palette.green700}>
                {formatCents(s.shareCents)}
              </Text>
            </View>
          ))
        )}
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: { paddingHorizontal: space.xl, gap: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  logo: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressSegOn: { backgroundColor: colors.primary },
  content: { padding: space.xl, paddingBottom: space.xxl },
  chapter: { gap: space.lg },
  title: { marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.md },
  insight: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.green50,
    borderWidth: 1,
    borderColor: palette.green100,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  optionIconOn: { backgroundColor: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  check: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  compareMuted: { gap: space.md, backgroundColor: colors.surfaceMuted, shadowOpacity: 0, elevation: 0 },
  compareOn: { gap: space.md, borderColor: palette.green200 },
  compareLine: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  demoHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  demoIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.green50, alignItems: 'center', justifyContent: 'center' },
  demoActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  notif: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  mode: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  modeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  splitLabel: { marginTop: space.lg, marginBottom: space.sm },
  splitResult: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: space.sm },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm, backgroundColor: colors.background },
});
