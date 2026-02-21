// Catálogo de Departamentos y Municipios de El Salvador
// CAT-012 y CAT-013: Basado en catálogo oficial del Ministerio de Hacienda

export interface Municipio {
  codigo: string;
  nombre: string;
}

export interface Departamento {
  codigo: string;
  nombre: string;
  municipios: Municipio[];
}

export const departamentos: Departamento[] = [
  {
    codigo: '01',
    nombre: 'AHUACHAPÁN',
    municipios: [
      { codigo: '01', nombre: 'AHUACHAPÁN' },
      { codigo: '02', nombre: 'APANECA' },
      { codigo: '03', nombre: 'ATIQUIZAYA' },
      { codigo: '04', nombre: 'CONCEPCIÓN DE ATACO' },
      { codigo: '05', nombre: 'EL REFUGIO' },
      { codigo: '06', nombre: 'GUAYMANGO' },
      { codigo: '07', nombre: 'JUJUTLA' },
      { codigo: '08', nombre: 'SAN FRANCISCO MENÉNDEZ' },
      { codigo: '09', nombre: 'SAN LORENZO' },
      { codigo: '10', nombre: 'SAN PEDRO PUXTLA' },
      { codigo: '11', nombre: 'TACUBA' },
      { codigo: '12', nombre: 'TURÍN' },
    ],
  },
  {
    codigo: '02',
    nombre: 'SANTA ANA',
    municipios: [
      { codigo: '01', nombre: 'CANDELARIA DE LA FRONTERA' },
      { codigo: '02', nombre: 'CHALCHUAPA' },
      { codigo: '03', nombre: 'COATEPEQUE' },
      { codigo: '04', nombre: 'EL CONGO' },
      { codigo: '05', nombre: 'EL PORVENIR' },
      { codigo: '06', nombre: 'MASAHUAT' },
      { codigo: '07', nombre: 'METAPÁN' },
      { codigo: '08', nombre: 'SAN ANTONIO PAJONAL' },
      { codigo: '09', nombre: 'SAN SEBASTIÁN SALITRILLO' },
      { codigo: '10', nombre: 'SANTA ANA' },
      { codigo: '11', nombre: 'SANTA ROSA GUACHIPILÍN' },
      { codigo: '12', nombre: 'SANTIAGO DE LA FRONTERA' },
      { codigo: '13', nombre: 'TEXISTEPEQUE' },
    ],
  },
  {
    codigo: '03',
    nombre: 'SONSONATE',
    municipios: [
      { codigo: '01', nombre: 'ACAJUTLA' },
      { codigo: '02', nombre: 'ARMENIA' },
      { codigo: '03', nombre: 'CALUCO' },
      { codigo: '04', nombre: 'CUISNAHUAT' },
      { codigo: '05', nombre: 'IZALCO' },
      { codigo: '06', nombre: 'JUAYÚA' },
      { codigo: '07', nombre: 'NAHUIZALCO' },
      { codigo: '08', nombre: 'NAHULINGO' },
      { codigo: '09', nombre: 'SALCOATITÁN' },
      { codigo: '10', nombre: 'SAN ANTONIO DEL MONTE' },
      { codigo: '11', nombre: 'SAN JULIÁN' },
      { codigo: '12', nombre: 'SANTA CATARINA MASAHUAT' },
      { codigo: '13', nombre: 'SANTA ISABEL ISHUATÁN' },
      { codigo: '14', nombre: 'SANTO DOMINGO DE GUZMÁN' },
      { codigo: '15', nombre: 'SONSONATE' },
      { codigo: '16', nombre: 'SONZACATE' },
    ],
  },
  {
    codigo: '04',
    nombre: 'CHALATENANGO',
    municipios: [
      { codigo: '01', nombre: 'AGUA CALIENTE' },
      { codigo: '02', nombre: 'ARCATAO' },
      { codigo: '03', nombre: 'AZACUALPA' },
      { codigo: '04', nombre: 'CHALATENANGO' },
      { codigo: '05', nombre: 'CITALÁ' },
      { codigo: '06', nombre: 'COMALAPA' },
      { codigo: '07', nombre: 'CONCEPCIÓN QUEZALTEPEQUE' },
      { codigo: '08', nombre: 'DULCE NOMBRE DE MARÍA' },
      { codigo: '09', nombre: 'EL CARRIZAL' },
      { codigo: '10', nombre: 'EL PARAÍSO' },
      { codigo: '11', nombre: 'LA LAGUNA' },
      { codigo: '12', nombre: 'LA PALMA' },
      { codigo: '13', nombre: 'LA REINA' },
      { codigo: '14', nombre: 'LAS VUELTAS' },
      { codigo: '15', nombre: 'NOMBRE DE JESÚS' },
      { codigo: '16', nombre: 'NUEVA CONCEPCIÓN' },
      { codigo: '17', nombre: 'NUEVA TRINIDAD' },
      { codigo: '18', nombre: 'OJOS DE AGUA' },
      { codigo: '19', nombre: 'POTONICO' },
      { codigo: '20', nombre: 'SAN ANTONIO DE LA CRUZ' },
      { codigo: '21', nombre: 'SAN ANTONIO LOS RANCHOS' },
      { codigo: '22', nombre: 'SAN FERNANDO' },
      { codigo: '23', nombre: 'SAN FRANCISCO LEMPA' },
      { codigo: '24', nombre: 'SAN FRANCISCO MORAZÁN' },
      { codigo: '25', nombre: 'SAN IGNACIO' },
      { codigo: '26', nombre: 'SAN ISIDRO LABRADOR' },
      { codigo: '27', nombre: 'SAN JOSÉ CANCASQUE' },
      { codigo: '28', nombre: 'SAN JOSÉ LAS FLORES' },
      { codigo: '29', nombre: 'SAN LUIS DEL CARMEN' },
      { codigo: '30', nombre: 'SAN MIGUEL DE MERCEDES' },
      { codigo: '31', nombre: 'SAN RAFAEL' },
      { codigo: '32', nombre: 'SANTA RITA' },
      { codigo: '33', nombre: 'TEJUTLA' },
    ],
  },
  {
    codigo: '05',
    nombre: 'LA LIBERTAD',
    municipios: [
      { codigo: '01', nombre: 'ANTIGUO CUSCATLÁN' },
      { codigo: '02', nombre: 'CHILTIUPÁN' },
      { codigo: '03', nombre: 'CIUDAD ARCE' },
      { codigo: '04', nombre: 'COLÓN' },
      { codigo: '05', nombre: 'COMASAGUA' },
      { codigo: '06', nombre: 'HUIZÚCAR' },
      { codigo: '07', nombre: 'JAYAQUE' },
      { codigo: '08', nombre: 'JICALAPA' },
      { codigo: '09', nombre: 'LA LIBERTAD' },
      { codigo: '10', nombre: 'NUEVO CUSCATLÁN' },
      { codigo: '11', nombre: 'QUEZALTEPEQUE' },
      { codigo: '12', nombre: 'SACACOYO' },
      { codigo: '13', nombre: 'SAN JOSÉ VILLANUEVA' },
      { codigo: '14', nombre: 'SAN JUAN OPICO' },
      { codigo: '15', nombre: 'SAN MATÍAS' },
      { codigo: '16', nombre: 'SAN PABLO TACACHICO' },
      { codigo: '17', nombre: 'SANTA TECLA' },
      { codigo: '18', nombre: 'TALNIQUE' },
      { codigo: '19', nombre: 'TAMANIQUE' },
      { codigo: '20', nombre: 'TEOTEPEQUE' },
      { codigo: '21', nombre: 'TEPECOYO' },
      { codigo: '22', nombre: 'ZARAGOZA' },
    ],
  },
  {
    codigo: '06',
    nombre: 'SAN SALVADOR',
    municipios: [
      { codigo: '01', nombre: 'AGUILARES' },
      { codigo: '02', nombre: 'APOPA' },
      { codigo: '03', nombre: 'AYUTUXTEPEQUE' },
      { codigo: '04', nombre: 'CUSCATANCINGO' },
      { codigo: '05', nombre: 'DELGADO' },
      { codigo: '06', nombre: 'EL PAISNAL' },
      { codigo: '07', nombre: 'GUAZAPA' },
      { codigo: '08', nombre: 'ILOPANGO' },
      { codigo: '09', nombre: 'MEJICANOS' },
      { codigo: '10', nombre: 'NEJAPA' },
      { codigo: '11', nombre: 'PANCHIMALCO' },
      { codigo: '12', nombre: 'ROSARIO DE MORA' },
      { codigo: '13', nombre: 'SAN MARCOS' },
      { codigo: '14', nombre: 'SAN MARTÍN' },
      { codigo: '15', nombre: 'SAN SALVADOR' },
      { codigo: '16', nombre: 'SANTIAGO TEXACUANGOS' },
      { codigo: '17', nombre: 'SANTO TOMÁS' },
      { codigo: '18', nombre: 'SOYAPANGO' },
      { codigo: '19', nombre: 'TONACATEPEQUE' },
    ],
  },
  {
    codigo: '07',
    nombre: 'CUSCATLÁN',
    municipios: [
      { codigo: '01', nombre: 'CANDELARIA' },
      { codigo: '02', nombre: 'COJUTEPEQUE' },
      { codigo: '03', nombre: 'EL CARMEN' },
      { codigo: '04', nombre: 'EL ROSARIO' },
      { codigo: '05', nombre: 'MONTE SAN JUAN' },
      { codigo: '06', nombre: 'ORATORIO DE CONCEPCIÓN' },
      { codigo: '07', nombre: 'SAN BARTOLOMÉ PERULAPÍA' },
      { codigo: '08', nombre: 'SAN CRISTÓBAL' },
      { codigo: '09', nombre: 'SAN JOSÉ GUAYABAL' },
      { codigo: '10', nombre: 'SAN PEDRO PERULAPÁN' },
      { codigo: '11', nombre: 'SAN RAFAEL CEDROS' },
      { codigo: '12', nombre: 'SAN RAMÓN' },
      { codigo: '13', nombre: 'SANTA CRUZ ANALQUITO' },
      { codigo: '14', nombre: 'SANTA CRUZ MICHAPA' },
      { codigo: '15', nombre: 'SUCHITOTO' },
      { codigo: '16', nombre: 'TENANCINGO' },
    ],
  },
  {
    codigo: '08',
    nombre: 'LA PAZ',
    municipios: [
      { codigo: '01', nombre: 'CUYULTITÁN' },
      { codigo: '02', nombre: 'EL ROSARIO' },
      { codigo: '03', nombre: 'JERUSALÉN' },
      { codigo: '04', nombre: 'MERCEDES LA CEIBA' },
      { codigo: '05', nombre: 'OLOCUILTA' },
      { codigo: '06', nombre: 'PARAÍSO DE OSORIO' },
      { codigo: '07', nombre: 'SAN ANTONIO MASAHUAT' },
      { codigo: '08', nombre: 'SAN EMIGDIO' },
      { codigo: '09', nombre: 'SAN FRANCISCO CHINAMECA' },
      { codigo: '10', nombre: 'SAN JUAN NONUALCO' },
      { codigo: '11', nombre: 'SAN JUAN TALPA' },
      { codigo: '12', nombre: 'SAN JUAN TEPEZONTES' },
      { codigo: '13', nombre: 'SAN LUIS TALPA' },
      { codigo: '14', nombre: 'SAN MIGUEL TEPEZONTES' },
      { codigo: '15', nombre: 'SAN PEDRO MASAHUAT' },
      { codigo: '16', nombre: 'SAN PEDRO NONUALCO' },
      { codigo: '17', nombre: 'SAN RAFAEL OBRAJUELO' },
      { codigo: '18', nombre: 'SANTA MARÍA OSTUMA' },
      { codigo: '19', nombre: 'SANTIAGO NONUALCO' },
      { codigo: '20', nombre: 'TAPALHUACA' },
      { codigo: '21', nombre: 'ZACATECOLUCA' },
      { codigo: '22', nombre: 'SAN LUIS LA HERRADURA' },
    ],
  },
  {
    codigo: '09',
    nombre: 'CABAÑAS',
    municipios: [
      { codigo: '01', nombre: 'CINQUERA' },
      { codigo: '02', nombre: 'DOLORES' },
      { codigo: '03', nombre: 'GUACOTECTI' },
      { codigo: '04', nombre: 'ILOBASCO' },
      { codigo: '05', nombre: 'JUTIAPA' },
      { codigo: '06', nombre: 'SAN ISIDRO' },
      { codigo: '07', nombre: 'SENSUNTEPEQUE' },
      { codigo: '08', nombre: 'TEJUTEPEQUE' },
      { codigo: '09', nombre: 'VICTORIA' },
    ],
  },
  {
    codigo: '10',
    nombre: 'SAN VICENTE',
    municipios: [
      { codigo: '01', nombre: 'APASTEPEQUE' },
      { codigo: '02', nombre: 'GUADALUPE' },
      { codigo: '03', nombre: 'SAN CAYETANO ISTEPEQUE' },
      { codigo: '04', nombre: 'SAN ESTEBAN CATARINA' },
      { codigo: '05', nombre: 'SAN ILDEFONSO' },
      { codigo: '06', nombre: 'SAN LORENZO' },
      { codigo: '07', nombre: 'SAN SEBASTIÁN' },
      { codigo: '08', nombre: 'SAN VICENTE' },
      { codigo: '09', nombre: 'SANTA CLARA' },
      { codigo: '10', nombre: 'SANTO DOMINGO' },
      { codigo: '11', nombre: 'TECOLUCA' },
      { codigo: '12', nombre: 'TEPETITÁN' },
      { codigo: '13', nombre: 'VERAPAZ' },
    ],
  },
  {
    codigo: '11',
    nombre: 'USULUTÁN',
    municipios: [
      { codigo: '01', nombre: 'ALEGRÍA' },
      { codigo: '02', nombre: 'BERLÍN' },
      { codigo: '03', nombre: 'CALIFORNIA' },
      { codigo: '04', nombre: 'CONCEPCIÓN BATRES' },
      { codigo: '05', nombre: 'EL TRIUNFO' },
      { codigo: '06', nombre: 'EREGUAYQUÍN' },
      { codigo: '07', nombre: 'ESTANZUELAS' },
      { codigo: '08', nombre: 'JIQUILISCO' },
      { codigo: '09', nombre: 'JUCUAPA' },
      { codigo: '10', nombre: 'JUCUARÁN' },
      { codigo: '11', nombre: 'MERCEDES UMAÑA' },
      { codigo: '12', nombre: 'NUEVA GRANADA' },
      { codigo: '13', nombre: 'OZATLÁN' },
      { codigo: '14', nombre: 'PUERTO EL TRIUNFO' },
      { codigo: '15', nombre: 'SAN AGUSTÍN' },
      { codigo: '16', nombre: 'SAN BUENAVENTURA' },
      { codigo: '17', nombre: 'SAN DIONISIO' },
      { codigo: '18', nombre: 'SAN FRANCISCO JAVIER' },
      { codigo: '19', nombre: 'SANTA ELENA' },
      { codigo: '20', nombre: 'SANTA MARÍA' },
      { codigo: '21', nombre: 'SANTIAGO DE MARÍA' },
      { codigo: '22', nombre: 'TECAPÁN' },
      { codigo: '23', nombre: 'USULUTÁN' },
    ],
  },
  {
    codigo: '12',
    nombre: 'SAN MIGUEL',
    municipios: [
      { codigo: '01', nombre: 'CAROLINA' },
      { codigo: '02', nombre: 'CHAPELTIQUE' },
      { codigo: '03', nombre: 'CHINAMECA' },
      { codigo: '04', nombre: 'CHIRILAGUA' },
      { codigo: '05', nombre: 'CIUDAD BARRIOS' },
      { codigo: '06', nombre: 'COMACARÁN' },
      { codigo: '07', nombre: 'EL TRÁNSITO' },
      { codigo: '08', nombre: 'LOLOTIQUE' },
      { codigo: '09', nombre: 'MONCAGUA' },
      { codigo: '10', nombre: 'NUEVA GUADALUPE' },
      { codigo: '11', nombre: 'NUEVO EDÉN DE SAN JUAN' },
      { codigo: '12', nombre: 'QUELEPA' },
      { codigo: '13', nombre: 'SAN ANTONIO' },
      { codigo: '14', nombre: 'SAN GERARDO' },
      { codigo: '15', nombre: 'SAN JORGE' },
      { codigo: '16', nombre: 'SAN LUIS DE LA REINA' },
      { codigo: '17', nombre: 'SAN MIGUEL' },
      { codigo: '18', nombre: 'SAN RAFAEL ORIENTE' },
      { codigo: '19', nombre: 'SESORI' },
      { codigo: '20', nombre: 'ULUAZAPA' },
    ],
  },
  {
    codigo: '13',
    nombre: 'MORAZÁN',
    municipios: [
      { codigo: '01', nombre: 'ARAMBALA' },
      { codigo: '02', nombre: 'CACAOPERA' },
      { codigo: '03', nombre: 'CHILANGA' },
      { codigo: '04', nombre: 'CORINTO' },
      { codigo: '05', nombre: 'DELICIAS DE CONCEPCIÓN' },
      { codigo: '06', nombre: 'EL DIVISADERO' },
      { codigo: '07', nombre: 'EL ROSARIO' },
      { codigo: '08', nombre: 'GUALOCOCTI' },
      { codigo: '09', nombre: 'GUATAJIAGUA' },
      { codigo: '10', nombre: 'JOATECA' },
      { codigo: '11', nombre: 'JOCOAITIQUE' },
      { codigo: '12', nombre: 'JOCORO' },
      { codigo: '13', nombre: 'LOLOTIQUILLO' },
      { codigo: '14', nombre: 'MEANGUERA' },
      { codigo: '15', nombre: 'OSICALA' },
      { codigo: '16', nombre: 'PERQUÍN' },
      { codigo: '17', nombre: 'SAN CARLOS' },
      { codigo: '18', nombre: 'SAN FERNANDO' },
      { codigo: '19', nombre: 'SAN FRANCISCO GOTERA' },
      { codigo: '20', nombre: 'SAN ISIDRO' },
      { codigo: '21', nombre: 'SAN SIMÓN' },
      { codigo: '22', nombre: 'SENSEMBRA' },
      { codigo: '23', nombre: 'SOCIEDAD' },
      { codigo: '24', nombre: 'TOROLA' },
      { codigo: '25', nombre: 'YAMABAL' },
      { codigo: '26', nombre: 'YOLOAIQUÍN' },
    ],
  },
  {
    codigo: '14',
    nombre: 'LA UNIÓN',
    municipios: [
      { codigo: '01', nombre: 'ANAMORÓS' },
      { codigo: '02', nombre: 'BOLÍVAR' },
      { codigo: '03', nombre: 'CONCEPCIÓN DE ORIENTE' },
      { codigo: '04', nombre: 'CONCHAGUA' },
      { codigo: '05', nombre: 'EL CARMEN' },
      { codigo: '06', nombre: 'EL SAUCE' },
      { codigo: '07', nombre: 'INTIPUCÁ' },
      { codigo: '08', nombre: 'LA UNIÓN' },
      { codigo: '09', nombre: 'LISLIQUE' },
      { codigo: '10', nombre: 'MEANGUERA DEL GOLFO' },
      { codigo: '11', nombre: 'NUEVA ESPARTA' },
      { codigo: '12', nombre: 'PASAQUINA' },
      { codigo: '13', nombre: 'POLORÓS' },
      { codigo: '14', nombre: 'SAN ALEJO' },
      { codigo: '15', nombre: 'SAN JOSÉ' },
      { codigo: '16', nombre: 'SANTA ROSA DE LIMA' },
      { codigo: '17', nombre: 'YAYANTIQUE' },
      { codigo: '18', nombre: 'YUCUAIQUÍN' },
    ],
  },
];

// Helper para obtener municipios por código de departamento
export const getMunicipiosByDepartamento = (codigoDepartamento: string): Municipio[] => {
  const depto = departamentos.find((d) => d.codigo === codigoDepartamento);
  return depto?.municipios || [];
};

// Helper para obtener nombre de departamento
export const getDepartamentoNombre = (codigo: string): string => {
  const depto = departamentos.find((d) => d.codigo === codigo);
  return depto?.nombre || '';
};

// Helper para obtener nombre de municipio
export const getMunicipioNombre = (codigoDepartamento: string, codigoMunicipio: string): string => {
  const municipios = getMunicipiosByDepartamento(codigoDepartamento);
  const muni = municipios.find((m) => m.codigo === codigoMunicipio);
  return muni?.nombre || '';
};

// Obtener departamento por código
export const getDepartamentoPorCodigo = (codigo: string): Departamento | undefined => {
  return departamentos.find(d => d.codigo === codigo);
};

// Buscar municipios por nombre
export const buscarMunicipios = (texto: string): Array<{ departamento: Departamento; municipio: Municipio }> => {
  const busqueda = texto.toLowerCase();
  const resultados: Array<{ departamento: Departamento; municipio: Municipio }> = [];
  
  departamentos.forEach(depto => {
    depto.municipios.forEach(muni => {
      if (muni.nombre.toLowerCase().includes(busqueda)) {
        resultados.push({ departamento: depto, municipio: muni });
      }
    });
  });
  
  return resultados;
};
