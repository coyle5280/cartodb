Sequel.migration do
  up do
    alter_table :user_tables do
      add_column :schema_alias, 'json'
    end
  end

  down do
    alter_table :user_tables do
      drop_column :schema_alias
    end
  end
end
