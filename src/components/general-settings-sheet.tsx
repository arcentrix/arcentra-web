import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GeneralSettings } from '@/api/general-settings/types';

interface JsonSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  enum?: any[];
  default?: any;
  minimum?: number;
  maximum?: number;
  format?: string;
}

interface GeneralSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: GeneralSettings | null;
  onSubmit: (data: {
    category: string;
    name: string;
    displayName: string;
    data: Record<string, any>;
    schema?: Record<string, any>;
    description?: string;
  }) => Promise<void>;
}

export function GeneralSettingsSheet({
  open,
  onOpenChange,
  settings,
  onSubmit,
}: GeneralSettingsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings && open) {
      setDisplayName(settings.displayName);
      setDescription(settings.description || '');

      const initialData: Record<string, any> = {};
      if (settings.schema && settings.schema.properties) {
        const properties = settings.schema.properties as Record<string, JsonSchemaProperty>;
        Object.keys(properties).forEach((key) => {
          initialData[key] = settings.data[key] ?? properties[key].default ?? getDefaultValue(properties[key]);
        });
      } else {
        Object.assign(initialData, settings.data);
      }

      setFormData(initialData);
      setErrors({});
    }
  }, [settings, open]);

  const getDefaultValue = (property: JsonSchemaProperty): any => {
    if (property.default !== undefined) return property.default;
    switch (property.type) {
      case 'string': return '';
      case 'integer':
      case 'number': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      default: return '';
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name cannot be empty';
    }

    if (settings?.schema && settings.schema.properties) {
      const properties = settings.schema.properties as Record<string, JsonSchemaProperty>;
      const required = settings.schema.required || [];

      Object.keys(properties).forEach((key) => {
        const property = properties[key];
        const value = formData[key];

        if (required.includes(key) && (value === undefined || value === null || value === '')) {
          newErrors[key] = `${property.title || key} is required`;
          return;
        }

        if (value !== undefined && value !== null && value !== '') {
          if (property.type === 'integer' && !Number.isInteger(Number(value))) {
            newErrors[key] = `${property.title || key} must be an integer`;
          } else if (property.type === 'number' && isNaN(Number(value))) {
            newErrors[key] = `${property.title || key} must be a number`;
          }

          if (property.enum && !property.enum.includes(value)) {
            newErrors[key] = `${property.title || key} must be one of: ${property.enum.join(', ')}`;
          }

          if (property.type === 'number' || property.type === 'integer') {
            const numValue = Number(value);
            if (property.minimum !== undefined && numValue < property.minimum) {
              newErrors[key] = `${property.title || key} must be at least ${property.minimum}`;
            }
            if (property.maximum !== undefined && numValue > property.maximum) {
              newErrors[key] = `${property.title || key} must be at most ${property.maximum}`;
            }
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      let processedData: Record<string, any> = {};
      if (settings?.schema && settings.schema.properties) {
        const properties = settings.schema.properties as Record<string, JsonSchemaProperty>;
        Object.keys(properties).forEach((key) => {
          const property = properties[key];
          let value = formData[key];
          if (property.type === 'integer') value = parseInt(value, 10);
          else if (property.type === 'number') value = parseFloat(value);
          else if (property.type === 'boolean') value = Boolean(value);
          processedData[key] = value;
        });
      } else if (settings) {
        Object.keys(settings.data).forEach((key) => {
          processedData[key] = formData[key];
        });
      }

      await onSubmit({
        category: settings!.category,
        name: settings!.name,
        displayName,
        data: processedData,
        schema: settings!.schema,
        description: description || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Submit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (key: string, property: JsonSchemaProperty) => {
    const value = formData[key] ?? getDefaultValue(property);
    const isRequired = settings?.schema?.required?.includes(key) || false;
    const error = errors[key];

    if (property.enum && property.enum.length > 0) {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>
            <span className="font-mono text-xs text-muted-foreground">{key}:</span>{' '}
            {property.title || key}
            {isRequired && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Select
            value={String(value)}
            onValueChange={(val) => {
              setFormData({ ...formData, [key]: val });
              if (errors[key]) setErrors({ ...errors, [key]: '' });
            }}
          >
            <SelectTrigger id={key}>
              <SelectValue placeholder={`Select ${property.title || key}`} />
            </SelectTrigger>
            <SelectContent>
              {property.enum.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {property.description && (
            <p className="text-xs text-muted-foreground">{property.description}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    }

    if (property.type === 'integer' || property.type === 'number') {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>
            <span className="font-mono text-xs text-muted-foreground">{key}:</span>{' '}
            {property.title || key}
            {isRequired && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Input
            id={key}
            type="number"
            value={value}
            onChange={(e) => {
              const val = e.target.value === ''
                ? ''
                : property.type === 'integer'
                  ? parseInt(e.target.value, 10)
                  : parseFloat(e.target.value);
              setFormData({ ...formData, [key]: val });
              if (errors[key]) setErrors({ ...errors, [key]: '' });
            }}
            min={property.minimum}
            max={property.maximum}
            placeholder={property.description}
          />
          {property.description && (
            <p className="text-xs text-muted-foreground">{property.description}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    }

    if (property.type === 'boolean') {
      return (
        <div key={key} className="space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id={key}
              checked={Boolean(value)}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, [key]: checked });
                if (errors[key]) setErrors({ ...errors, [key]: '' });
              }}
            />
            <Label htmlFor={key} className="cursor-pointer">
              <span className="font-mono text-xs text-muted-foreground">{key}:</span>{' '}
              {property.title || key}
              {isRequired && <span className="text-destructive ml-0.5">*</span>}
            </Label>
          </div>
          {property.description && (
            <p className="text-xs text-muted-foreground">{property.description}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key}>
          <span className="font-mono text-xs text-muted-foreground">{key}:</span>{' '}
          {property.title || key}
          {isRequired && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Input
          id={key}
          type={property.format === 'email' ? 'email' : 'text'}
          value={String(value)}
          onChange={(e) => {
            setFormData({ ...formData, [key]: e.target.value });
            if (errors[key]) setErrors({ ...errors, [key]: '' });
          }}
          placeholder={property.description}
        />
        {property.description && (
          <p className="text-xs text-muted-foreground">{property.description}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle>Edit Configuration</SheetTitle>
          <SheetDescription>
            {settings?.displayName && (
              <span className="font-medium text-foreground">{settings.displayName}</span>
            )}
            {settings?.displayName && ' — '}
            Edit system general configuration item
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 py-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sheet-category" className="text-xs text-muted-foreground">Category</Label>
                    <Input
                      id="sheet-category"
                      value={settings?.category || ''}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sheet-name" className="text-xs text-muted-foreground">Config Name</Label>
                    <Input
                      id="sheet-name"
                      value={settings?.name || ''}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sheet-displayName">
                    Display Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sheet-displayName"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (errors.displayName) setErrors({ ...errors, displayName: '' });
                    }}
                    placeholder="e.g.: JWT Secret, SMTP Config"
                  />
                  {errors.displayName && (
                    <p className="text-sm text-destructive">{errors.displayName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sheet-description">Description</Label>
                  <Input
                    id="sheet-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed description of the configuration"
                  />
                </div>
              </div>

              <Separator />

              {/* Configuration Data */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Configuration Data</h3>
                <div className="space-y-4">
                  {settings?.schema && settings.schema.properties ? (
                    Object.entries(settings.schema.properties as Record<string, JsonSchemaProperty>).map(
                      ([key, property]) => (
                        <div key={key}>{renderField(key, property)}</div>
                      )
                    )
                  ) : (
                    settings && Object.entries(settings.data).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`sheet-field-${key}`}>
                          <span className="font-mono text-xs text-muted-foreground">{key}</span>
                        </Label>
                        <Input
                          id={`sheet-field-${key}`}
                          type="text"
                          value={typeof formData[key] === 'object' ? JSON.stringify(formData[key]) : String(formData[key] ?? value)}
                          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                          placeholder={`Value for ${key}`}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <Separator />
          <SheetFooter className="px-6 py-4 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
