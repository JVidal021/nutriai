import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const LAST_UPDATE = '27 de maio de 2025'
const SUPPORT_EMAIL = 'suporte.nutriai@outlook.com'

export default function TermsScreen() {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 60 }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
        <Text style={s.closeTxt}>✕ Fechar</Text>
      </TouchableOpacity>

      <Text style={s.title}>Termos de Uso</Text>
      <Text style={s.meta}>NutriAI · Última atualização: {LAST_UPDATE}</Text>

      <Section title="1. Aceitação dos Termos">
        Ao criar uma conta ou utilizar o aplicativo NutriAI, você concorda integralmente com estes Termos de Uso. Caso não concorde, não utilize o app. O uso continuado após alterações implica aceitação das novas versões.
      </Section>

      <Section title="2. Descrição do Serviço">
        O NutriAI é um aplicativo de acompanhamento nutricional e de treinos que utiliza Inteligência Artificial para:
        {'\n'}• Gerar planos alimentares e de exercícios personalizados;
        {'\n'}• Analisar fotos de refeições e estimar macronutrientes;
        {'\n'}• Oferecer orientações de saúde e bem-estar por meio de um Coach IA;
        {'\n'}• Fornecer métricas de progresso e gamificação.
        {'\n\n'}O NutriAI <Text style={s.bold}>não é um serviço médico</Text>, não substitui consulta com nutricionista, médico ou educador físico habilitado. As informações fornecidas têm caráter educativo e estimativo.
      </Section>

      <Section title="3. Cadastro e Responsabilidades do Usuário">
        • Você deve ter pelo menos 16 anos para criar uma conta;
        {'\n'}• As informações fornecidas (idade, peso, altura, condições de saúde) devem ser verdadeiras;
        {'\n'}• Você é responsável pela segurança de suas credenciais de acesso;
        {'\n'}• É proibido compartilhar acesso, revender ou usar o serviço de forma fraudulenta.
      </Section>

      <Section title="4. Plano Gratuito e Premium">
        O NutriAI oferece uma versão gratuita com recursos limitados e uma versão Premium paga com acesso completo. Os recursos de cada plano estão descritos na tela de Assinatura do app e podem ser alterados mediante aviso prévio de 15 dias.
      </Section>

      <Section title="5. Assinatura Premium">
        <Text style={s.bold}>5.1 Cobrança:</Text> O pagamento é processado pela plataforma Mercado Pago. Ao confirmar a assinatura, você autoriza a cobrança conforme o plano escolhido (mensal ou anual).
        {'\n\n'}<Text style={s.bold}>5.2 Renovação:</Text> As assinaturas são renovadas automaticamente ao final de cada período, salvo cancelamento prévio.
        {'\n\n'}<Text style={s.bold}>5.3 Cancelamento:</Text> Para cancelar, envie e-mail para{' '}
        <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Cancelar assinatura NutriAI`)}>
          {SUPPORT_EMAIL}
        </Text>
        {' '}até 48h antes da próxima renovação. Não há reembolso proporcional pelo período já utilizado.
        {'\n\n'}<Text style={s.bold}>5.4 Preços:</Text> Os valores vigentes estão disponíveis na tela de Assinatura. Alterações de preço serão comunicadas com 30 dias de antecedência.
      </Section>

      <Section title="6. Propriedade Intelectual">
        Todo o conteúdo do NutriAI (marca, design, algoritmos, textos, planos gerados) é de propriedade exclusiva do desenvolvedor. É proibida reprodução, distribuição ou uso comercial sem autorização escrita.
        {'\n\n'}As fotos enviadas por você permanecem de sua propriedade. Você concede ao NutriAI licença limitada para processar essas imagens exclusivamente para gerar análises nutricionais.
      </Section>

      <Section title="7. Limitação de Responsabilidade">
        O NutriAI não se responsabiliza por:
        {'\n'}• Resultados específicos de saúde, emagrecimento ou ganho de massa;
        {'\n'}• Imprecisões nas estimativas nutricionais geradas por IA;
        {'\n'}• Danos decorrentes do uso das informações sem acompanhamento profissional;
        {'\n'}• Indisponibilidade temporária do serviço por manutenção ou falhas técnicas.
      </Section>

      <Section title="8. Condutas Proibidas">
        É proibido:
        {'\n'}• Tentar acessar dados de outros usuários;
        {'\n'}• Usar o app para fins ilegais;
        {'\n'}• Fazer engenharia reversa do aplicativo;
        {'\n'}• Compartilhar conteúdo ofensivo através dos recursos de Co-op ou Coach.
        {'\n\n'}Violações podem resultar em suspensão ou exclusão imediata da conta.
      </Section>

      <Section title="9. Alterações e Encerramento">
        Podemos atualizar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas por notificação no app. O encerramento do serviço será informado com 30 dias de antecedência.
      </Section>

      <Section title="10. Foro e Lei Aplicável">
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de domicílio do usuário para dirimir eventuais conflitos.
      </Section>

      <Section title="Contato">
        Dúvidas sobre estes Termos:{'\n'}
        <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          {SUPPORT_EMAIL}
        </Text>
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
