import { ClientSession } from "mongodb";
import { BadRequestError, logger, useAtlas } from "@ph-deped-ncr/utils";
import { MCounter, TCounter } from "./../models/counter.model";

export default function useCounterRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("counters");

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ type: 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Counter type already exists");
      }

      throw error;
    }
  }

  async function createNewCounter(type: string) {
    const value = new MCounter({ type });
    try {
      await collection.insertOne(value);

      return "Successfully created new counter.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function incrementCounterByType(type = "", session?: ClientSession) {
    try {
      return (await collection.findOneAndUpdate({ type }, { $inc: { value: 1 } }, { session, returnDocument: "after" })) as TCounter;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createUniqueIndex,
    createNewCounter,
    incrementCounterByType,
  };
}
