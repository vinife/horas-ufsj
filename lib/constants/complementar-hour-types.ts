import type { ComplementarHourType } from "@prisma/client";

export const COMPLEMENTAR_HOUR_TYPE_LABELS: Record<
  ComplementarHourType,
  string
> = {
  INICIACAO_CIENTIFICA: "Projetos e/ou programas de iniciação científica",
  MONITORIA: "Projetos e/ou programas de monitoria",
  ESTAGIO_NAO_OBRIGATORIO_TRAINEE:
    "Estágio não obrigatório ou Trainee em Empresa Júnior",
  CERTIFICACAO_LINGUA_ESTRANGEIRA: "Certificação em língua estrangeira",
  CURSO_IDIOMAS: "Curso de idiomas",
  CURSOS_LIVRES_CC:
    "Cursos livres, presenciais ou online, na área de Ciência da Computação",
  CERTIFICACAO_TECNOLOGIA_CC:
    "Certificação oficial em linguagens/tecnologias/metodologias de CC",
  GRUPO_ESTUDO_CC: "Participação em grupo de estudo na área de CC",
  PARTICIPACAO_EVENTOS: "Participação em eventos",
  ORGANIZACAO_EVENTOS: "Organização de eventos",
  PUBLICACAO_ARTIGO_COMPLETO:
    "Publicação de artigo completo em congresso ou periódico (qualis A/B)",
  APRESENTACAO_ARTIGO_COMPLETO:
    "Apresentação de artigo completo em congresso/simpósio (qualis A/B)",
  APRESENTACAO_CURSO_CURTA_DURACAO: "Apresentação de curso de curta duração",
  EQUIPE_COMPETICAO_UFSJ: "Participação de equipe de competição da UFSJ",
  COMPETICAO_EQUIPE_REGISTRADA_UFSJ:
    "Participação em competição por equipe registrada na UFSJ",
  REPRESENTACAO_ESTUDANTIL: "Representação estudantil",
  DIRETORIA_ATLETICA: "Participação na Diretoria de Atlética",
  PET_GET: "Programa / Grupo de Educação Tutorial (PET/GET)",
  COMPETICAO_ATLETICA: "Participação em Competição por Atlética",
  GESTAO_EMPRESA_JUNIOR: "Participação em cargos de gestão da Empresa Júnior",
  DOACAO_SANGUE: "Doação de sangue para Fundação pública",
};

/** `null` = sem teto explícito (Anexo I, IN 01/2024 CCOMP). */
export const COMPLEMENTAR_HOUR_TYPE_CAPS: Record<
  ComplementarHourType,
  number | null
> = {
  INICIACAO_CIENTIFICA: null,
  MONITORIA: 180,
  ESTAGIO_NAO_OBRIGATORIO_TRAINEE: 180,
  CERTIFICACAO_LINGUA_ESTRANGEIRA: 45,
  CURSO_IDIOMAS: 30,
  CURSOS_LIVRES_CC: 45,
  CERTIFICACAO_TECNOLOGIA_CC: 90,
  GRUPO_ESTUDO_CC: 60,
  PARTICIPACAO_EVENTOS: 30,
  ORGANIZACAO_EVENTOS: 60,
  PUBLICACAO_ARTIGO_COMPLETO: null,
  APRESENTACAO_ARTIGO_COMPLETO: null,
  APRESENTACAO_CURSO_CURTA_DURACAO: 30,
  EQUIPE_COMPETICAO_UFSJ: 90,
  COMPETICAO_EQUIPE_REGISTRADA_UFSJ: 60,
  REPRESENTACAO_ESTUDANTIL: 90,
  DIRETORIA_ATLETICA: 90,
  PET_GET: 180,
  COMPETICAO_ATLETICA: 30,
  GESTAO_EMPRESA_JUNIOR: 180,
  DOACAO_SANGUE: 30,
};

export const COMPLEMENTAR_HOUR_TYPE_OPTIONS = Object.entries(
  COMPLEMENTAR_HOUR_TYPE_LABELS,
).map(([value, label]) => ({
  value: value as ComplementarHourType,
  label,
}));
