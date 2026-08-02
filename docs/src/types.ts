/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DbTableColumn {
  tableName: string;
  columnName: string;
  dataType: string;
  sampleValues: any[];
}

export interface DqProfile {
  table_name: string;
  column_name: string;
  data_type: string;
  total_rows: number;
  null_rate: number;
  distinct_rate: number;
  min_value: any;
  max_value: any;
  avg_value: number | null;
  stddev_value: number | null;
  min_length: number | null;
  max_length: number | null;
  sample_values: any[];
}

export interface DqRule {
  id: string;
  table_name: string;
  column_name: string;
  rule_type: string;
  rule_config: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  generated_by: string;
  dq_type: 'Completeness' | 'Uniqueness' | 'Validity' | 'Accuracy' | 'Consistency' | 'Timeliness';
  status: 'proposed' | 'approved' | 'rejected';
  created_at?: string;
}

export interface DqViolation {
  id: string;
  table_name: string;
  column_name: string;
  rule_type: string;
  offending_value: string;
  violation_details: {
    rule_config: Record<string, any>;
    query: string;
  };
  detected_at: string;
  dq_type: string;
}

export interface SimulationLog {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'SQL' | 'AI' | 'WARN' | 'ERROR';
  message: string;
}
