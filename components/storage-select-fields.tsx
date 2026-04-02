import {
  getStorageBinDisplayLabel,
  getStorageBinSlots,
  getStorageShelfOptionLabel,
  storageBinRequiresSlot,
  type StorageBinOption,
  type StorageLocationOption,
  type StorageShelfOption
} from "@/lib/storage-ui";

type FieldWrapperProps = {
  label: string;
  children: React.ReactNode;
  wrapperClassName?: string;
  labelClassName?: string;
};

function FieldWrapper({ label, children, wrapperClassName, labelClassName }: FieldWrapperProps) {
  return (
    <label className={wrapperClassName || "text-sm"}>
      <span className={labelClassName || "mb-1 block"}>{label}</span>
      {children}
    </label>
  );
}

type StorageLocationSelectFieldProps = {
  label: string;
  value: string;
  options: StorageLocationOption[];
  onChange: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
  optionLabel?: (option: StorageLocationOption) => string;
};

export function StorageLocationSelectField({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  disabled,
  wrapperClassName,
  labelClassName,
  selectClassName,
  optionLabel
}: StorageLocationSelectFieldProps) {
  return (
    <FieldWrapper label={label} wrapperClassName={wrapperClassName} labelClassName={labelClassName}>
      <select
        className={selectClassName || "input mt-1"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {optionLabel ? optionLabel(option) : option.name}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

type StorageShelfSelectFieldProps = {
  label: string;
  value: string;
  shelves: StorageShelfOption[];
  onChange: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
};

export function StorageShelfSelectField({
  label,
  value,
  shelves,
  onChange,
  emptyLabel,
  disabled,
  wrapperClassName,
  labelClassName,
  selectClassName
}: StorageShelfSelectFieldProps) {
  return (
    <FieldWrapper label={label} wrapperClassName={wrapperClassName} labelClassName={labelClassName}>
      <select
        className={selectClassName || "input mt-1"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{emptyLabel}</option>
        {shelves.map((shelf) => (
          <option key={shelf.id} value={shelf.id}>
            {getStorageShelfOptionLabel(shelf)}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

type StorageBinSelectFieldProps = {
  label: string;
  value: string;
  bins: StorageBinOption[];
  shelves?: StorageShelfOption[];
  onChange: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
};

export function StorageBinSelectField({
  label,
  value,
  bins,
  shelves,
  onChange,
  emptyLabel,
  disabled,
  wrapperClassName,
  labelClassName,
  selectClassName
}: StorageBinSelectFieldProps) {
  return (
    <FieldWrapper label={label} wrapperClassName={wrapperClassName} labelClassName={labelClassName}>
      <select
        className={selectClassName || "input mt-1"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{emptyLabel}</option>
        {bins.map((bin) => (
          <option key={bin.id} value={bin.id}>
            {getStorageBinDisplayLabel(bin, shelves)}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

type StorageBinSlotSelectFieldProps = {
  label: string;
  value: string;
  selectedBin: StorageBinOption | null;
  shelves?: StorageShelfOption[];
  onChange: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
};

export function StorageBinSlotSelectField({
  label,
  value,
  selectedBin,
  shelves,
  onChange,
  emptyLabel,
  disabled,
  wrapperClassName,
  labelClassName,
  selectClassName
}: StorageBinSlotSelectFieldProps) {
  const slotOptions = getStorageBinSlots(selectedBin);
  const drawerLabel = getStorageBinDisplayLabel(selectedBin, shelves);

  return (
    <FieldWrapper label={label} wrapperClassName={wrapperClassName} labelClassName={labelClassName}>
      <select
        className={selectClassName || "input mt-1"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{emptyLabel}</option>
        {storageBinRequiresSlot(selectedBin) &&
          slotOptions.map((slot) => (
            <option key={slot} value={String(slot)}>
              {drawerLabel ? `${drawerLabel}-${slot}` : slot}
            </option>
          ))}
      </select>
    </FieldWrapper>
  );
}
