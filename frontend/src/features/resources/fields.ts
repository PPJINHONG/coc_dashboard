import type { Bootstrap } from "../../shared/api/operations";
import { regionField, remarksField, type Field } from "../../shared/fields";
import { RESOURCE_SERVICES } from "./api";

/** 인프라 자원 열. 백엔드 features/resources/serializers.py와 같은 이름을 씁니다. */
export function resourceFields(data: Bootstrap): Field[] {
  return [
    regionField(data),
    {
      key: "service",
      label: "서비스",
      type: "select",
      options: RESOURCE_SERVICES.map((service) => ({ value: service, label: service })),
    },
    { key: "host_count", label: "Host", type: "number" },
    { key: "vm_count", label: "VM", type: "number", nullable: true },
    {
      key: "compute_rack_count",
      label: "Compute Rack",
      type: "number",
      nullable: true,
    },
    {
      key: "storage_count",
      label: "Storage Rack",
      type: "number",
      nullable: true,
    },
    remarksField,
  ];
}
