import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

const LAST_UPDATE = '27 de maio de 2025'
const SUPPORT_EMAIL = 'suporte.nutriai@outlook.com'

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 60 }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
        <Text style={s.closeTxt}>✕ {t('common.close' as any)}</Text>
      </TouchableOpacity>

      <Text style={s.title}>Política de Privacidade</Text>
      <Text style={s.meta}>NutriAI · Última atualização: {LAST_UPDATE}</Text>

      <Section title="1. Quem somos (Controlador dos Dados)">
        O NutriAI é um aplicativo de saúde e bem-estar. Para fins da Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD), o desenvolvedor do NutriAI é o Controlador dos dados pessoais tratados neste serviço.
        {'\n\n'}Contato do Encarregado (DPO):{'\n'}
        <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          {SUPPORT_EMAIL}
        </Text>
      </Section>

      <Section title="2. Dados Coletados">
        <Text style={s.bold}>2.1 Dados fornecidos por você:</Text>
        {'\n'}• Nome e endereço de e-mail (cadastro);
        {'\n'}• Idade, sexo/gênero, peso atual, peso desejado e altura;
        {'\n'}• Objetivo de saúde (perder peso, ganhar massa, etc.);
        {'\n'}• Nível de atividade física e experiência em academia;
        {'\n'}• Restrições alimentares e alergias;
        {'\n'}• Registros de humor diário (check-in emocional);
        {'\n'}• Feedback textual sobre planos alimentares e de treino.
        {'\n\n'}<Text style={s.bold}>2.2 Dados gerados pelo uso:</Text>
        {'\n'}• Fotos de refeições (analisadas e descartadas após processamento);
        {'\n'}• Histórico de refeições registradas e calorias consumidas;
        {'\n'}• Registros de treinos completados;
        {'\n'}• Histórico de peso;
        {'\n'}• Dados de gamificação (XP, streaks, ranks).
        {'\n\n'}<Text style={s.bold}>2.3 Dados técnicos:</Text>
        {'\n'}• Token de autenticação (armazenado localmente no dispositivo);
        {'\n'}• Informações de dispositivo para diagnóstico de erros (sem identificação pessoal).
      </Section>

      <Section title="3. Finalidade do Tratamento">
        • <Text style={s.bold}>Prestação do serviço:</Text> gerar planos personalizados, analisar refeições e fornecer orientações;
        {'\n'}• <Text style={s.bold}>Execução do contrato:</Text> gerenciar conta, assinatura Premium e pagamentos;
        {'\n'}• <Text style={s.bold}>Melhoria contínua:</Text> aprimorar algoritmos de recomendação (dados anonimizados);
        {'\n'}• <Text style={s.bold}>Segurança:</Text> prevenir fraudes e acessos não autorizados;
        {'\n'}• <Text style={s.bold}>Comunicação:</Text> enviar notificações de lembrete (somente com sua permissão).
      </Section>

      <Section title="4. Base Legal (LGPD)">
        O tratamento dos seus dados é realizado com base em:
        {'\n'}• <Text style={s.bold}>Consentimento</Text> (Art. 7º, I) — para dados de saúde sensíveis e notificações;
        {'\n'}• <Text style={s.bold}>Execução de contrato</Text> (Art. 7º, V) — para prestação do serviço contratado;
        {'\n'}• <Text style={s.bold}>Legítimo interesse</Text> (Art. 7º, IX) — para segurança e melhoria do serviço.
      </Section>

      <Section title="5. Compartilhamento de Dados">
        Seus dados podem ser compartilhados com:
        {'\n\n'}• <Text style={s.bold}>Supabase (EUA)</Text> — plataforma de banco de dados e autenticação. Dados armazenados em servidores certificados com criptografia em repouso e em trânsito;
        {'\n'}• <Text style={s.bold}>Groq / Meta AI (EUA)</Text> — processamento de linguagem natural para geração de planos e análises (dados enviados sem identificação pessoal direta);
        {'\n'}• <Text style={s.bold}>Mercado Pago</Text> — processamento de pagamentos da assinatura Premium (dados financeiros gerenciados diretamente pelo Mercado Pago, sujeito à política de privacidade própria);
        {'\n'}• <Text style={s.bold}>RapidAPI / ExerciseDB</Text> — busca de demonstrações de exercícios (somente nome do exercício é enviado).
        {'\n\n'}Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins publicitários.
      </Section>

      <Section title="6. Transferência Internacional">
        Alguns de nossos fornecedores operam nos EUA. A transferência é realizada com garantias adequadas de proteção, incluindo cláusulas contratuais padrão e certificações de conformidade (ex.: SOC 2 da Supabase).
      </Section>

      <Section title="7. Retenção de Dados">
        • Dados da conta: mantidos enquanto a conta estiver ativa;
        {'\n'}• Após exclusão da conta: dados removidos em até 30 dias;
        {'\n'}• Fotos de refeições: descartadas imediatamente após análise pela IA;
        {'\n'}• Dados de pagamento: retidos conforme exigência legal tributária (5 anos).
      </Section>

      <Section title="8. Seus Direitos (LGPD, Art. 18)">
        Como titular dos seus dados, você tem direito a:
        {'\n'}• <Text style={s.bold}>Acesso:</Text> solicitar cópia dos seus dados;
        {'\n'}• <Text style={s.bold}>Correção:</Text> atualizar dados incorretos (disponível nas configurações do perfil);
        {'\n'}• <Text style={s.bold}>Exclusão:</Text> solicitar remoção dos seus dados (disponível em Perfil → Excluir conta);
        {'\n'}• <Text style={s.bold}>Portabilidade:</Text> receber seus dados em formato estruturado;
        {'\n'}• <Text style={s.bold}>Revogação do consentimento:</Text> a qualquer momento, sem prejuízo de tratamentos anteriores;
        {'\n'}• <Text style={s.bold}>Oposição:</Text> contestar tratamentos baseados em legítimo interesse.
        {'\n\n'}Para exercer esses direitos, entre em contato pelo e-mail{' '}
        <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Direitos LGPD - NutriAI`)}>
          {SUPPORT_EMAIL}
        </Text>
        . Responderemos em até 15 dias úteis.
      </Section>

      <Section title="9. Segurança">
        Adotamos medidas técnicas e organizacionais para proteger seus dados:
        {'\n'}• Criptografia TLS em todas as comunicações;
        {'\n'}• Credenciais armazenadas com criptografia no dispositivo (SecureStore);
        {'\n'}• Autenticação com tokens JWT de curta duração;
        {'\n'}• Acesso ao banco de dados restrito por Row Level Security (RLS).
      </Section>

      <Section title="10. Menores de Idade">
        O NutriAI não é destinado a menores de 16 anos. Caso identifiquemos dados de menores coletados sem consentimento parental, procederemos com a exclusão imediata.
      </Section>

      <Section title="11. Atualizações desta Política">
        Esta Política pode ser atualizada periodicamente. Mudanças relevantes serão comunicadas por notificação no app ou por e-mail com antecedência mínima de 15 dias.
      </Section>

      <Section title="Contato">
        Dúvidas, solicitações ou reclamações:{'\n'}
        <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Privacidade - NutriAI`)}>
          {SUPPORT_EMAIL}
        </Text>
        {'\n\n'}Você também pode registrar reclamações na Autoridade Nacional de Proteção de Dados (ANPD): www.gov.br/anpd
      </Section>
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionBody}>{children}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  content:      { paddingHorizontal: Spacing[5] },
  closeBtn:     { alignSelf: 'flex-end', backgroundColor: Colors.bg3, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  closeTxt:     { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  title:        { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  meta:         { fontSize: 12, color: Colors.text3, marginBottom: 24 },
  section:      { marginBottom: 20, backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.accent, marginBottom: 8 },
  sectionBody:  { fontSize: 13, color: Colors.text2, lineHeight: 20 },
  bold:         { fontWeight: '700', color: Colors.text },
  link:         { color: Colors.accent, textDecorationLine: 'underline' },
})
