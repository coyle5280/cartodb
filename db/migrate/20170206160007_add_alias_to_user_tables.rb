Sequel.migration do
  up do
    alter_table :user_tables do
      add_column :alias, :text
      add_column :alias_columns, 'json'
    end
  end

  down do
    alter_table :user_tables do
      drop_column :alias
      drop_column :alias_columns
    end
  end
end
