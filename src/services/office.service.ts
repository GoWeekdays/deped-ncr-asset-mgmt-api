import { logger, NotFoundError } from "@ph-deped-ncr/utils";
import { TOffice } from "./../models/office.model";
import useOfficeRepository from "./../repositories/office.repository";
import useDivisionRepository from "./../repositories/division.repository";

export default function useOfficeService() {
  const {
    createOffice: _createOffice,
    getOffices: _getOffices,
    getOfficeById: _getOfficeById,
    updateOffice: _updateOffice,
    deleteOffice: _deleteOffice,
    getOfficeNames: _getOfficeNames,
    getOfficesWithoutOfficeChief: _getOfficesWithoutOfficeChief,
  } = useOfficeRepository();
  const { getDivisionById } = useDivisionRepository();

  async function createOffice({ name, email, divisionId }: { name: string; email: string; divisionId: string }) {
    try {
      if (divisionId) {
        const division = await getDivisionById(divisionId);
        if (!division) {
          throw new NotFoundError("Division not found.");
        }
      }

      return await _createOffice({ name, email, divisionId });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getOffices({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    try {
      return await _getOffices({ page, limit, sort, search });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getOfficeById(_id: string) {
    try {
      return await _getOfficeById(_id);
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching office by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function updateOffice(_id: string, value: TOffice) {
    const office = await _getOfficeById(_id);
    if (!office) throw new NotFoundError("Office not found.");

    if (value.divisionId) {
      const division = await getDivisionById(value.divisionId);
      if (!division) throw new NotFoundError("Division not found.");
    }

    try {
      return await _updateOffice(_id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteOffice(id: string) {
    try {
      return await _deleteOffice(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getOfficeNames(search?: string) {
    try {
      return await _getOfficeNames(search);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getOfficesWithoutOfficeChief(type: string) {
    try {
      const items = await _getOfficesWithoutOfficeChief(type);
      return items;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createOffice,
    getOffices,
    getOfficeById,
    updateOffice,
    deleteOffice,
    getOfficeNames,
    getOfficesWithoutOfficeChief,
  };
}
