import { logger, NotFoundError } from "@ph-deped-ncr/utils";
import { TDivision } from "./../models/division.model";
import useDivisionRepo from "./../repositories/division.repository";

export default function useDivisionService() {
  const {
    createDivision: _createDivision,
    getDivisions: _getDivisions,
    getDivisionById: _getDivisionById,
    updateDivision: _updateDivision,
    deleteDivision: _deleteDivision,
  } = useDivisionRepo();

  async function createDivision(value: TDivision) {
    try {
      return await _createDivision(value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getDivisions({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    try {
      return await _getDivisions({ page, limit, sort, search });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getDivisionById(id: string) {
    try {
      return await _getDivisionById(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateDivision(id: string, value: TDivision) {
    const division = await _getDivisionById(id);
    if (!division) {
      throw new NotFoundError("Division not found.");
    }

    try {
      return await _updateDivision(id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteDivision(id: string) {
    const division = await _getDivisionById(id);
    if (!division) {
      throw new NotFoundError("Division not found.");
    }

    try {
      return await _deleteDivision(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createDivision,
    getDivisions,
    getDivisionById,
    updateDivision,
    deleteDivision,
  };
}
