# Política de Privacidade — OrçaPro

**Última atualização:** 4 de novembro de 2026  
**Em conformidade com a LGPD (Lei Geral de Proteção de Dados nº 13.709/2018)**

O **OrçaPro** foi desenvolvido com o compromisso fundamental de respeitar e proteger a sua privacidade. Esta Política de Privacidade descreve como as informações são tratadas pelo nosso aplicativo.

---

## 1. Arquitetura Local-First (Armazenamento no Próprio Dispositivo)
O OrçaPro opera sob o princípio de **armazenamento local (offline-first)**:
- **Dados de Clientes e Serviços:** Nomes de clientes, descrições de serviços, valores, materiais, mão de obra e fotos de logotipos são salvos **exclusivamente na memória interna do seu próprio dispositivo móvel** (banco de dados SQLite local).
- Nenhum desses dados é transmitido, copiado ou sincronizado com servidores externos operados por nós.

---

## 2. Dados Pessoais Coletados
Nós **NÃO** coletamos, armazenamos ou compartilhamos dados pessoais sensíveis, tais como CPF, dados biométricos ou histórico de crédito em servidores nossos.

No próprio aparelho, o aplicativo pode ler o identificador do dispositivo (**Android ID**) unicamente para organizar a contagem local da cota gratuita mensal. Esse identificador não é enviado a servidores operados pelo OrçaPro.

---

## 3. Chaves Pix e Geração de QR Code
A Chave Pix informada nas configurações é utilizada única e exclusivamente no seu aparelho para renderizar o QR Code estático e preencher a mensagem de cobrança no arquivo PDF do orçamento. Essa informação permanece no seu dispositivo e nunca é enviada para servidores externos.

---

## 4. Pagamentos e Assinaturas (Google Play Billing)
O processamento de pagamentos para as versões Pro e pacotes de créditos é realizado de forma 100% segura e direta pela **Google Play Store (Google LLC)**.
- O OrçaPro não tem acesso e não armazena números de cartão de crédito ou dados bancários de faturamento.
- Recebemos da Google apenas o status da licença (compra permanente ativa e/ou assinatura) associada à sua conta Google para desbloquear os recursos Pro. Um cache local seguro desse status é mantido no aparelho para uso offline.

---

## 5. Compartilhamento de Arquivos PDF
Ao optar por compartilhar um orçamento em PDF via WhatsApp, e-mail ou outro canal, a ação é realizada pelo sistema nativo de compartilhamento do seu sistema operacional Android. O envio ocorre diretamente entre o seu aparelho e o destinatário escolhido.

---

## 6. Permissões de Microfone e Câmera (Assistente IA)
O aplicativo solicita permissões específicas apenas quando você decide utilizar os recursos opcionais do Assistente IA:
- **Microfone (`android.permission.RECORD_AUDIO`):** Utilizado exclusivamente no momento em que você pressiona o botão de ditar por voz para transcrever os itens e valores do orçamento. O áudio é processado para extração técnica dos itens e não é gravado permanentemente nem compartilhado com terceiros para fins publicitários.
- **Câmera e Fotos (`android.permission.CAMERA` / `READ_MEDIA_IMAGES`):** Utilizadas exclusivamente quando você escolhe fotografar materiais ou selecionar a logomarca da sua empresa para estampar no cabeçalho do PDF.

---

## 7. Direitos do Usuário (LGPD)
Como os dados ficam gravados exclusivamente no seu dispositivo, você possui controle absoluto e imediato sobre eles: para excluir permanentemente qualquer registro ou histórico, basta excluir o orçamento no próprio aplicativo ou desinstalar o OrçaPro do seu dispositivo.

---

## 8. Contato e Suporte
Para dúvidas, suporte ou esclarecimentos referentes a esta Política de Privacidade, entre em contato através do e-mail do desenvolvedor:

- **E-mail:** [lin030682@gmail.com](mailto:lin030682@gmail.com)
- **Desenvolvedor:** Paulo Lin (OrçaPro)

---
*© 2026 OrçaPro · Todos os direitos reservados.*
