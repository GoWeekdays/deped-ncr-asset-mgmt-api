import { ClientSession } from "mongodb";
import { BadRequestError, logger, useAtlas } from "@ph-deped-ncr/utils";
import { MRISlipSerialNo, TRISlipSerialNo } from "./../models/ris-serial-no.model";

export default function useRISlipSerialNoRepo() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("risSerialNo");

  async function createIndex() {
    try {
      await collection.createIndex({ risId: 1 });

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ serialNo: 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createRISlipSerialNo(value: TRISlipSerialNo, session?: ClientSession) {
    const risSerialNo = new MRISlipSerialNo(value);

    try {
      await collection.insertOne(risSerialNo, { session });
      return risSerialNo.serialNo;
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("RIS Report Serial No. already exists.");
      }

      throw error;
    }
  }

  return {
    createUniqueIndex,
    createIndex,
    createRISlipSerialNo,
  };
}
