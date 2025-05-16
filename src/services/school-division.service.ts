import { logger, NotFoundError } from "@ph-deped-ncr/utils";
import { TSchoolDivision } from "./../models/school-division.model";
import useSchoolDivisionRepo from "./../repositories/school-division.repository";

export default function useSchoolDivisionService() {
  const {
    createSchoolDivision: _createSchoolDivision,
    getSchoolDivisions: _getSchoolDivisions,
    getSchoolDivisionById: _getSchoolDivisionById,
    updateSchoolDivision: _updateSchoolDivision,
    deleteSchoolDivision: _deleteSchoolDivision,
  } = useSchoolDivisionRepo();

  async function createSchoolDivision(value: TSchoolDivision) {
    try {
      return await _createSchoolDivision(value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getSchoolDivisions({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    try {
      const items = await _getSchoolDivisions({ page, limit, sort, search });
      return items;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getSchoolDivisionById(id: string) {
    try {
      const schoolDivision = await _getSchoolDivisionById(id);
      if (!schoolDivision) {
        throw new NotFoundError("School division not found.");
      }

      return schoolDivision;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateSchoolDivision(id: string, value: TSchoolDivision) {
    const schoolDivision = await _getSchoolDivisionById(id);
    if (!schoolDivision) {
      throw new NotFoundError("School division not found.");
    }

    try {
      return await _updateSchoolDivision(id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteSchoolDivision(id: string) {
    const schoolDivision = await _getSchoolDivisionById(id);
    if (!schoolDivision) {
      throw new NotFoundError("School division not found.");
    }

    try {
      return await _deleteSchoolDivision(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createSchoolDivision,
    getSchoolDivisions,
    getSchoolDivisionById,
    updateSchoolDivision,
    deleteSchoolDivision,
  };
}
