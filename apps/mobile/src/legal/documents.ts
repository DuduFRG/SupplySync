/**
 * Termos de Uso e Política de Privacidade do SupplySync.
 *
 * Fonte única: o app mostra estes textos e `npm run legal:export` gera as versões
 * em Markdown (docs/legal) para publicar em um site, exigência das lojas.
 *
 * ANTES DE PUBLICAR NAS LOJAS: preencha os dados de RESPONSAVEL abaixo e peça
 * para um(a) advogado(a) revisar. Este texto é um modelo fiel ao funcionamento do app,
 * não uma consultoria jurídica.
 */

export const RESPONSAVEL = {
  nome: '[NOME COMPLETO OU RAZÃO SOCIAL]',
  documento: '[CPF OU CNPJ]',
  email: '[E-MAIL DE CONTATO]',
  cidade: '[CIDADE/UF]',
};

export const VERSAO = '16 de novembro de 2026';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: 'termos' | 'privacidade';
  title: string;
  intro: string;
  sections: LegalSection[];
}

const contato = `${RESPONSAVEL.email}`;

export const TERMOS: LegalDocument = {
  slug: 'termos',
  title: 'Termos de Uso',
  intro: `Estes Termos explicam as regras para usar o SupplySync, oferecido por ${RESPONSAVEL.nome} (${RESPONSAVEL.documento}). Ao criar uma conta, você declara que leu e concorda com eles.`,
  sections: [
    {
      title: '1. O que é o SupplySync',
      paragraphs: [
        'O SupplySync é um aplicativo para organizar itens de consumo recorrente de uma casa (como papel higiênico, sabão e ração), indicar quem deve comprar cada item e registrar quanto cada morador pagou, para dividir os custos.',
        'O app apenas registra e calcula valores. Ele não movimenta dinheiro, não faz cobranças entre moradores e não é uma instituição financeira. Os pagamentos entre moradores acontecem fora do app, por conta de vocês.',
      ],
    },
    {
      title: '2. Quem pode usar',
      paragraphs: [
        'O SupplySync é destinado a maiores de 18 anos. Ao criar uma conta, você confirma ter 18 anos ou mais.',
        'Você é responsável por manter sua senha em segredo e por tudo o que for feito com a sua conta. Se suspeitar de uso indevido, troque a senha e fale com a gente.',
      ],
    },
    {
      title: '3. Casas, convites e informações compartilhadas',
      paragraphs: [
        'Ao entrar em uma casa, as informações que você registra nela (itens, sinalizações, fotos, observações, compras e pagamentos) ficam visíveis para todos os moradores daquela casa.',
        'Só convide pessoas em quem você confia. Quem administra a casa pode renomeá-la e remover moradores. Ao sair ou ser removido, o histórico de compras continua nas contas da casa, para não prejudicar os saldos de quem fica.',
        'Não registre na casa informações que você não queira compartilhar com os outros moradores.',
      ],
    },
    {
      title: '4. Uso permitido',
      paragraphs: [
        'Você concorda em não usar o app para: enviar conteúdo ilegal, ofensivo ou que viole direitos de outras pessoas; tentar acessar dados de casas das quais não faz parte; sobrecarregar, testar falhas ou contornar as proteções do serviço sem autorização; ou criar contas automatizadas.',
        'Podemos suspender ou encerrar contas que descumpram estes Termos, especialmente em casos que coloquem outros usuários ou o serviço em risco.',
      ],
    },
    {
      title: '5. Planos e assinatura',
      paragraphs: [
        'O plano gratuito tem limites de moradores, itens e histórico, informados dentro do app. O plano Família, quando disponível, é uma assinatura cobrada pela App Store ou pelo Google Play.',
        'A cobrança, a renovação automática e o cancelamento da assinatura seguem as regras da loja onde ela foi contratada. Você pode cancelar a qualquer momento nas configurações da sua conta da Apple ou do Google.',
      ],
    },
    {
      title: '6. Disponibilidade e responsabilidade',
      paragraphs: [
        'Trabalhamos para manter o app disponível e seguro, mas ele pode passar por manutenções, falhas ou interrupções. Os avisos de itens dependem da internet e dos serviços de notificação da Apple e do Google, e podem atrasar ou não chegar.',
        'Os cálculos de divisão dependem dos valores que os moradores registram. Confira os valores antes de fazer qualquer pagamento. Na máxima extensão permitida pela lei, não nos responsabilizamos por desentendimentos entre moradores ou por valores registrados de forma incorreta.',
        'Nada nestes Termos limita direitos que você tenha como consumidor pela legislação brasileira.',
      ],
    },
    {
      title: '7. Encerramento da conta',
      paragraphs: [
        'Você pode excluir sua conta a qualquer momento em Ajustes > Excluir conta. O que acontece com seus dados está descrito na Política de Privacidade.',
      ],
    },
    {
      title: '8. Mudanças nestes Termos',
      paragraphs: [
        'Podemos atualizar estes Termos. Quando a mudança for relevante, avisaremos dentro do app antes de ela valer. Continuar usando o app depois do aviso significa concordar com a nova versão.',
      ],
    },
    {
      title: '9. Lei aplicável e contato',
      paragraphs: [
        `Estes Termos seguem as leis do Brasil. Fica eleito o foro do domicílio do consumidor. Dúvidas: ${contato}.`,
      ],
    },
  ],
};

export const PRIVACIDADE: LegalDocument = {
  slug: 'privacidade',
  title: 'Política de Privacidade',
  intro: `Esta Política explica quais dados o SupplySync usa, por quê e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD). O controlador dos dados é ${RESPONSAVEL.nome} (${RESPONSAVEL.documento}), ${RESPONSAVEL.cidade}.`,
  sections: [
    {
      title: '1. Dados que coletamos',
      paragraphs: [
        'Conta: seu nome (como a casa te chama), e-mail e senha. A senha nunca é guardada em texto: armazenamos apenas um código irreversível gerado a partir dela (hash Argon2id).',
        'Uso da casa: casas que você cria ou participa, itens, sinalizações (acabando, acabou), observações, fotos que você decidir anexar, compras, valores, divisões e pagamentos registrados.',
        'Aparelho: se você ativar os avisos, um identificador de notificação do seu celular. Guardamos também, por segurança, o endereço de internet (IP) e o horário das requisições em registros técnicos temporários.',
        'Fotos: antes do envio, o app remove os dados escondidos da imagem, inclusive a localização GPS.',
        'Não coletamos contatos, localização, microfone, dados de cartão nem informações para publicidade. Não vendemos dados.',
      ],
    },
    {
      title: '2. Para que usamos e com qual base legal',
      paragraphs: [
        'Para criar sua conta, fazer o app funcionar, mostrar o estado da casa, sugerir quem compra, calcular a divisão e enviar avisos: execução do contrato com você (art. 7º, V, da LGPD).',
        'Para proteger contas e o serviço contra fraudes, robôs e acessos indevidos (limites de tentativas, verificação antirrobô, registros técnicos): legítimo interesse e prevenção à fraude (art. 7º, IX, e art. 11, II, "g").',
        'Para enviar e-mails de confirmação e de redefinição de senha: execução do contrato.',
        'Para cumprir obrigações legais, quando houver: cumprimento de obrigação legal (art. 7º, II).',
      ],
    },
    {
      title: '3. Com quem compartilhamos',
      paragraphs: [
        'Com os moradores da sua casa: tudo o que você registra na casa fica visível para eles.',
        'Com prestadores de serviço que operam dados em nosso nome, apenas no necessário: hospedagem do servidor e do banco de dados, envio de e-mails (Resend), envio de notificações (Expo, Apple e Google), proteção contra ataques e robôs (Cloudflare) e, para assinaturas, as lojas de aplicativos.',
        'Alguns desses prestadores podem processar dados fora do Brasil. Nesses casos, exigimos garantias adequadas de proteção, conforme os arts. 33 a 36 da LGPD.',
        'Com autoridades, somente quando houver obrigação legal ou ordem judicial.',
      ],
    },
    {
      title: '4. Por quanto tempo guardamos',
      paragraphs: [
        'Enquanto sua conta existir. Códigos de confirmação expiram em 15 minutos. Sessões de acesso expiram em até 30 dias sem uso. Registros técnicos de segurança são mantidos pelo tempo necessário à segurança e ao cumprimento da lei (Marco Civil da Internet, art. 15, quando aplicável).',
        'Ao excluir a conta, apagamos seu nome, e-mail, senha e identificadores de notificação. As compras que você registrou continuam nas contas da casa, associadas a um perfil anônimo chamado "Ex-morador", para não alterar os saldos dos outros moradores.',
      ],
    },
    {
      title: '5. Como protegemos',
      paragraphs: [
        'Conexão criptografada (HTTPS), senhas com hash forte, sessões que expiram e se renovam com segurança, chave de acesso guardada no cofre seguro do celular, controle para que cada pessoa só veja os dados das casas de que participa, limites contra tentativas repetidas e verificação antirrobô.',
        'Nenhum sistema é totalmente imune a falhas. Se ocorrer um incidente de segurança que possa causar risco relevante, avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD), como determina a lei.',
      ],
    },
    {
      title: '6. Seus direitos',
      paragraphs: [
        'Você pode, a qualquer momento: confirmar se tratamos seus dados, acessá-los, corrigir dados incompletos ou desatualizados, pedir anonimização, bloqueio ou eliminação de dados desnecessários, pedir a portabilidade, saber com quem compartilhamos e revogar consentimentos (art. 18 da LGPD).',
        `Você mesmo pode alterar seu nome e excluir sua conta em Ajustes. Para os demais pedidos, escreva para ${contato}. Respondemos em até 15 dias.`,
        'Você também pode reclamar à ANPD (www.gov.br/anpd).',
      ],
    },
    {
      title: '7. Crianças e adolescentes',
      paragraphs: ['O app é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de menores de idade.'],
    },
    {
      title: '8. Encarregado e contato',
      paragraphs: [`Encarregado pelo tratamento de dados (DPO): ${RESPONSAVEL.nome}, ${contato}.`],
    },
    {
      title: '9. Mudanças nesta Política',
      paragraphs: [
        'Podemos atualizar esta Política. Mudanças relevantes serão avisadas dentro do app antes de valerem. A data da versão atual aparece no topo deste documento.',
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = { termos: TERMOS, privacidade: PRIVACIDADE } as const;
