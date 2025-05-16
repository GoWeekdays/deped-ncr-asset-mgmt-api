import { initRedisClient } from "./redis";
import useFileService from "./services/file.service";

import { logger } from "@ph-deped-ncr/utils";
import { TAssetCode } from "./models/asset-code.model";
import { TConfig } from "./models/configuration.model";
import useAssetRepository from "./repositories/asset.repository";
import useAssetCodeRepository from "./repositories/asset-code.repository";
import useConfigRepository from "./repositories/configuration.repository";
import useCounterRepository from "./repositories/counter.repository";
import useDivisionRepository from "./repositories/division.repository";
import useIssueSlipRepository from "./repositories/issue-slip.repository";
import useMaintenanceRepository from "./repositories/maintenance.repository";
import useOfficeRepository from "./repositories/office.repository";
import useRISlipRepository from "./repositories/ris.repository";
import useSchoolRepository from "./repositories/school.repository";
import useSchoolDivisionRepository from "./repositories/school-division.repository";
import useAssetCodeService from "./services/asset-code.service";
import useLossRepository from "./repositories/loss.repository";
import useConfigService from "./services/configuration.service";
import useRISlipSerialNoRepo from "./repositories/ris-serial-no.repository";
import useReturnRepository from "./repositories/return.repository";
import useStockRepository from "./repositories/stock.repository";
import useTransferRepository from "./repositories/transfer.repository";
import useWasteRepository from "./repositories/waste.repository";

interface Repository {
  name: string;
  repo: {
    createIndex?: () => Promise<void> | Promise<string>;
    createSearchIndex?: () => Promise<void> | Promise<string>;
    createUniqueIndex?: () => Promise<void> | Promise<string>;
  };
}

const createAssetCodes = async (assetCodes: TAssetCode[], type: string) => {
  const { createAssetCode } = useAssetCodeService();

  for (const { code, value } of assetCodes) {
    try {
      const result = await createAssetCode({ type, code, value });
      logger.log({
        level: result ? "info" : "warn",
        message: result ? `${type} created successfully: ${result}` : `${type} creation failed`,
      });
    } catch (error: any) {
      logger.log({
        level: "error",
        message: `Error creating ${type}: ${error}`,
      });
    }
  }
};

const createConfigurations = async (configurations: TConfig[]) => {
  const { createConfig } = useConfigService();

  for (const { name, value } of configurations) {
    try {
      const result = await createConfig({ name, value });
      logger.log({
        level: result ? "info" : "warn",
        message: result ? `Configuration created successfully: ${result}` : `Configuration creation failed`,
      });
    } catch (error: any) {
      logger.log({
        level: "error",
        message: `Error creating configuration: ${error}`,
      });
    }
  }
};

const processRepositories = async (repositories: Repository[]) => {
  for (const { name, repo } of repositories) {
    try {
      if (repo.createIndex) {
        const result = await repo.createIndex();
        logger.log({ level: "info", message: `Field index created: ${result}` });
      }

      if (repo.createSearchIndex) {
        const result = await repo.createSearchIndex();
        logger.log({ level: "info", message: `Search index created: ${result}` });
      }

      if (repo.createUniqueIndex) {
        const result = await repo.createUniqueIndex();
        logger.log({ level: "info", message: `Unique index created: ${result}` });
      }
    } catch (error: any) {
      logger.log({
        level: "error",
        message: `Error processing ${name}: ${error.message}`,
      });
    }
  }
};

const initializeCounters = async () => {
  const counterRepo = useCounterRepository();
  try {
    await counterRepo.createUniqueIndex();
    const counters = [
      "consumable",
      "semi-expendable-property",
      "property-plant-equipment",
      "requisition-and-issue-slips",
      "ris-serial-no",
      "inventory-custodian-slips",
      "property-acknowledgement-receipts",
      "inventory-transfer-report",
      "property-transfer-report",
      "RLSDDSP",
      "RLSDDP",
      "return-SEP",
      "return-PPE",
      "maintenance",
    ];
    for (const counter of counters) {
      await counterRepo.createNewCounter(counter);
    }
  } catch (error: any) {
    logger.log({ level: "error", message: `Error initializing counters: ${error.message}` });
  }
};

export default async () => {
  await initRedisClient();

  const { deleteDraft } = useFileService();

  deleteDraft();

  const locations = [
    { code: "01", value: "Office of the Regional Director" },
    { code: "02", value: "Office of the Assistant Regional Director" },
    { code: "03", value: "ICTU" },
    { code: "04", value: "Legal Unit" },
    { code: "05", value: "Public Affairs Unit" },
    { code: "06", value: "PPRD" },
    { code: "07", value: "Office of the Chief Administrative Officer" },
    { code: "08", value: "Cash Section" },
    { code: "09", value: "General Service Unit" },
    { code: "10", value: "Personnel Section" },
    { code: "11", value: "Records Section" },
    { code: "12", value: "RPSU" },
    { code: "13", value: "Supply & Property Section" },
    { code: "14", value: "CLMD" },
    { code: "15", value: "LRMDC" },
    { code: "16", value: "ESSD" },
    { code: "17", value: "Education Facilities" },
    { code: "18", value: "RDRRM Office" },
    { code: "19", value: "SHNU" },
    { code: "20", value: "FTAD" },
    { code: "21", value: "Finance Division" },
    { code: "22", value: "QAD" },
    { code: "23", value: "HRDD" },
    { code: "24", value: "Bids and Awards and Committee" },
    { code: "25", value: "Commission on Audit" },
    { code: "26", value: "NEAP - MARIKINA" },
    { code: "27", value: "FOUR STOREY VARELA" },
    { code: "28", value: "2 STOREY CONFERENCE ROOM" },
    { code: "29", value: "CHAPEL" },
    { code: "30", value: "LRP" },
  ];
  const serialCodes = [
    { code: "01", value: "Power Supply Systems" },
    { code: "02", value: "Buildings" },
    { code: "03", value: "Land" },
    { code: "04", value: "Office Equipment" },
    { code: "05", value: "Information and Communication Technology Equipment" },
    { code: "06", value: "Communication Equipment" },
    { code: "07", value: "Medical Equipment" },
    { code: "08", value: "Other Equipment" },
    { code: "09", value: "Motor Vehicles" },
    { code: "10", value: "Furnitures and Fixtures" },
    { code: "11", value: "Books" },
    { code: "12", value: "Other Property, Plant, and Equipment" },
  ];
  const sepCodes = [
    { code: "05-10", value: "Semi Expendable Machinery" },
    { code: "05-20", value: "Semi Expendable Office Equipment" },
    { code: "05-30", value: "Semi Expendable ICT" },
    { code: "05-70", value: "Semi Expendable Communication" },
    { code: "05-80", value: "Semi Expendable Disaster Response and Rescue Equipment" },
    { code: "05-100", value: "Semi Expendable Medical Equipment" },
    { code: "05-110", value: "Semi Expendable Printing Equipment" },
    { code: "05-120", value: "Semi Expendable Sport Equipment" },
    { code: "05-140", value: "Semi Expendable Construction and Heavy Equipment" },
    { code: "05-190", value: "Semi Expendable Other Machinery and Equipment" },
    { code: "06-10", value: "Semi Expendable Furniture and Fixtures" },
    { code: "06-20", value: "Semi Expendable Books" },
  ];
  const ppeCodes = [
    { code: "03-50", value: "Power Supply Systems", year: 30 },
    { code: "04-10", value: "Buildings", year: 30 },
    { code: "01-10", value: "Land" },
    { code: "05-20", value: "Office Equipment", year: 5 },
    { code: "05-30", value: "Information and Communication Technology Equipment", year: 5 },
    { code: "05-70", value: "Communication Equipment", year: 5 },
    { code: "05-110", value: "Medical Equipment", year: 10 },
    { code: "05-990", value: "Other Equipment", year: 5 },
    { code: "06-010", value: "Motor Vehicles", year: 7 },
    { code: "07-10", value: "Furnitures and Fixtures", year: 10 },
  ];

  const assetCodes: { data: TAssetCode[]; type: string }[] = [
    { data: locations, type: "location-code" },
    { data: serialCodes, type: "serial-code" },
    { data: sepCodes, type: "sep-code" },
    { data: ppeCodes, type: "ppe-code" },
  ];

  const repositories: Repository[] = [
    { name: "Asset", repo: useAssetRepository() },
    { name: "Asset Code", repo: useAssetCodeRepository() },
    { name: "Configuration", repo: useConfigRepository() },
    { name: "Division", repo: useDivisionRepository() },
    { name: "Issue Slip", repo: useIssueSlipRepository() },
    { name: "Loss", repo: useLossRepository() },
    { name: "Maintenance", repo: useMaintenanceRepository() },
    { name: "Office", repo: useOfficeRepository() },
    { name: "Return", repo: useReturnRepository() },
    { name: "RIS", repo: useRISlipRepository() },
    { name: "RIS Report Serial No.", repo: useRISlipSerialNoRepo() },
    { name: "School", repo: useSchoolRepository() },
    { name: "School Division", repo: useSchoolDivisionRepository() },
    { name: "Stock", repo: useStockRepository() },
    { name: "Transfer", repo: useTransferRepository() },
    { name: "Waste", repo: useWasteRepository() },
  ];

  const configurations: TConfig[] = [
    { name: "Fund Cluster - Consumable", value: "01-101-101" },
    { name: "Fund Cluster - SEP", value: "01-101-101" },
    { name: "Fund Cluster - PPE", value: "Capital Outlay" },
    { name: "Entity Name", value: "DepEd NCR" },
    { name: "Responsibility Center Code", value: "07-001-00-00000-02-99-02" },
  ];

  try {
    for (const { data, type } of assetCodes) {
      await createAssetCodes(data, type);
    }

    await createConfigurations(configurations);
    await processRepositories(repositories);
    await initializeCounters();
  } catch (error: any) {
    logger.log({ level: "error", message: `Initialization failed: ${error.message}` });
  }
};
