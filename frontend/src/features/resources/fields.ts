import type { Bootstrap } from "../../shared/api/operations";
import { regionField, remarksField, serviceField, type Field } from "../../shared/fields";

/** 인프라 자원 열. 백엔드 features/resources/serializers.py와 같은 이름을 씁니다. */
export function resourceFields(data: Bootstrap): Field[] {
  return [
    regionField(data),
    serviceField(data),
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
